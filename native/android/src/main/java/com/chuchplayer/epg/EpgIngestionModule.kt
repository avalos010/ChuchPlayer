package com.chuchplayer.epg

import android.content.Context
import android.util.Log
import androidx.work.*
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import io.realm.Realm
import kotlinx.coroutines.*
import kotlinx.coroutines.sync.withLock
import okhttp3.*
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit

class EpgIngestionModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    init {
        ensureRealmInitialized(reactContext.applicationContext)
        cancelLegacyBackgroundSyncs(reactContext.applicationContext)
    }

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    private fun ensureRealmInitialized(context: Context) {
        try {
            Realm.init(context.applicationContext)
        } catch (_: IllegalStateException) {
            // Realm is already initialized.
        }
    }

    private fun cancelLegacyBackgroundSyncs(context: Context) {
        val prefs = context.getSharedPreferences("epg_sync_prefs", Context.MODE_PRIVATE)
        if (prefs.getBoolean("bounded_ingestion_v1", false)) return
        WorkManager.getInstance(context).cancelAllWorkByTag("epg_sync")
        prefs.edit().putBoolean("bounded_ingestion_v1", true).apply()
    }

    companion object {
        private const val TAG            = "EpgIngestionModule"
        private const val EVENT_PROGRESS = "EPG_INGESTION_PROGRESS"
        private const val EVENT_COMPLETE = "EPG_INGESTION_COMPLETE"
        private const val EVENT_ERROR    = "EPG_INGESTION_ERROR"
        private const val SYNC_HOURS     = 4L
        private val activeIngestions = ConcurrentHashMap<String, CompletableDeferred<Int>>()
        private val syncLock = Any()
        private var scheduledPlaylistId: String? = null
    }

    override fun getName() = "EpgIngestionModule"

    @ReactMethod
    fun startIngestion(
        epgUrl: String,
        playlistId: String,
        channelsJson: String,
        datasetSignature: String?,
        promise: Promise
    ) {
        val resolvedEpgUrl = resolveEpgUrl(epgUrl)
        val ingestionKey = "$playlistId|$resolvedEpgUrl"
        Log.d(TAG, "startIngestion: playlist=$playlistId host=${resolvedEpgUrl.toHttpUrlOrNull()?.host ?: "unknown"}")
        cancelStaleBackgroundSyncs(playlistId)

        val completion = CompletableDeferred<Int>()
        val existing = activeIngestions.putIfAbsent(ingestionKey, completion)
        if (existing != null) {
            scope.launch {
                try {
                    promise.resolve(existing.await())
                } catch (t: Throwable) {
                    promise.reject("INGESTION_ERROR", t.message ?: "Ingestion failed")
                }
            }
            return
        }

        foregroundIngestionCount.incrementAndGet()
        scope.launch {
            try {
                val written = epgIngestionMutex.withLock {
                    val channelIndex = parseChannelsJson(channelsJson)
                    Log.d(TAG, "Channel index built: ${channelIndex.size} entries")

                    val body = fetchWithRetry(resolvedEpgUrl)
                        ?: throw IllegalStateException("Failed to fetch EPG after retries")

                    var totalWritten = 0
                    body.use {
                        val parsed = streamXmlPrograms(it.byteStream(), playlistId, channelIndex) { batch ->
                            totalWritten += writeBatch(batch)
                            sendEvent(EVENT_PROGRESS, Arguments.createMap().apply {
                                putInt("programsProcessed", totalWritten)
                                putString("epgUrl", resolvedEpgUrl)
                            })
                        }
                        Log.d(TAG, "Parsed $parsed matching programs")
                    }

                    if (!datasetSignature.isNullOrEmpty()) {
                        updatePlaylistMetadata(playlistId, datasetSignature)
                    }
                    totalWritten
                }

                completion.complete(written)

                sendEvent(EVENT_COMPLETE, Arguments.createMap().apply {
                    putInt("programsCount", written)
                    putString("epgUrl", resolvedEpgUrl)
                })

                // Schedule background refresh — failure here must NOT fail the promise
                // because all data is already written and the metadata updated.
                try {
                    scheduleBackgroundSync(resolvedEpgUrl, playlistId, channelsJson, datasetSignature)
                } catch (e: Exception) {
                    Log.w(TAG, "Background sync scheduling failed (non-fatal): ${e.message}")
                }

                promise.resolve(written)
            } catch (t: Throwable) {
                completion.completeExceptionally(t)
                val msg = "Ingestion failed: ${t.message}"
                Log.e(TAG, msg, t)
                sendEvent(EVENT_ERROR, Arguments.createMap().apply {
                    putString("error", msg)
                    putString("epgUrl", resolvedEpgUrl)
                })
                try { promise.reject("INGESTION_ERROR", msg) } catch (_: Exception) {}
            } finally {
                foregroundIngestionCount.decrementAndGet()
                activeIngestions.remove(ingestionKey, completion)
            }
        }
    }

    @ReactMethod
    fun schedulePeriodicSync(
        epgUrl: String,
        playlistId: String,
        channelsJson: String,
        datasetSignature: String?,
        promise: Promise
    ) {
        try {
            scheduleBackgroundSync(epgUrl, playlistId, channelsJson, datasetSignature)
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "schedulePeriodicSync failed", e)
            promise.reject("SCHEDULE_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun cancelPeriodicSync(playlistId: String, epgUrl: String, promise: Promise) {
        try {
            WorkManager.getInstance(reactApplicationContext)
                .cancelUniqueWork(workName(playlistId, epgUrl))
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "cancelPeriodicSync failed", e)
            promise.reject("CANCEL_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun queryPrograms(playlistId: String, channelIds: ReadableArray, promise: Promise) {
        scope.launch {
            try {
                val ids = (0 until channelIds.size()).mapNotNull { channelIds.getString(it) }
                Log.d(TAG, "queryPrograms: playlist=$playlistId channels=$ids")
                val now = System.currentTimeMillis()
                val lowerBound = now - HOURS_BEFORE * 3_600_000L
                val upperBound = now + HOURS_AFTER * 3_600_000L

                val realm = openRealm()
                try {
                    // Single query for all channels instead of N per-channel queries
                    val idsArray = ids.toTypedArray()
                    val allPrograms = realm.where(ProgramRealm::class.java)
                        .equalTo("playlistId", playlistId)
                        .`in`("channelId", idsArray)
                        .greaterThan("end", java.util.Date(lowerBound))
                        .lessThan("start", java.util.Date(upperBound))
                        .findAll()

                    // Group results in Kotlin before bridging to JS
                    val grouped = ids.associateWith { mutableListOf<ProgramRealm>() }
                    allPrograms.forEach { p -> grouped[p.channelId]?.add(p) }

                    val result = Arguments.createMap()
                    var totalPrograms = 0
                    ids.forEach { channelId ->
                        val programs = grouped[channelId] ?: emptyList()
                        val arr = Arguments.createArray()
                        programs.forEach { p ->
                            arr.pushMap(Arguments.createMap().apply {
                                putString("id", p.id)
                                putString("channelId", p.channelId)
                                putString("title", p.title)
                                putString("description", p.description ?: "")
                                putDouble("start", p.start.time.toDouble())
                                putDouble("end", p.end.time.toDouble())
                            })
                        }
                        totalPrograms += arr.size()
                        Log.d(TAG, "queryPrograms: channel=$channelId results=${arr.size()}")
                        result.putArray(channelId, arr)
                    }
                    Log.d(TAG, "queryPrograms: playlist=$playlistId totalChannels=${ids.size} totalPrograms=$totalPrograms")
                    promise.resolve(result)
                } finally {
                    realm.close()
                }
            } catch (t: Throwable) {
                Log.e(TAG, "queryPrograms failed", t)
                try { promise.reject("QUERY_ERROR", t.message ?: "Query failed") } catch (_: Exception) {}
            }
        }
    }

    @ReactMethod
    fun getNativePlaylistMetadata(playlistId: String, promise: Promise) {
        scope.launch {
            try {
                val realm = openRealm()
                try {
                    val meta = realm.where(MetadataRealm::class.java)
                        .equalTo("playlistId", playlistId)
                        .findFirst()
                    if (meta == null) {
                        promise.resolve(null)
                    } else {
                        promise.resolve(Arguments.createMap().apply {
                            putString("playlistId", meta.playlistId)
                            putDouble("lastUpdated", meta.lastUpdated.time.toDouble())
                            putString("sourceSignature", meta.sourceSignature ?: "")
                        })
                    }
                } finally {
                    realm.close()
                }
            } catch (t: Throwable) {
                Log.e(TAG, "getNativePlaylistMetadata failed", t)
                try { promise.resolve(null) } catch (_: Exception) {}
            }
        }
    }

    // ── private helpers ──────────────────────────────────────────────────────

    private suspend fun fetchWithRetry(
        url: String
    ): okhttp3.ResponseBody? {
        val client = OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(120, TimeUnit.SECONDS)
            .build()
        val request = Request.Builder()
            .url(url)
            .header("User-Agent", "chuchPlayer/1.0")
            .header("Accept", "application/xml, text/xml, */*")
            .build()

        repeat(4) { attempt ->
            try {
                val response = client.newCall(request).execute()
                if (response.code == 429) {
                    response.close()
                    val wait = (response.header("Retry-After")?.toLongOrNull() ?: (1L shl attempt)) * 1000L
                    Log.w(TAG, "429 rate-limited, waiting ${wait}ms (attempt ${attempt + 1})")
                    delay(wait)
                    return@repeat
                }
                if (!response.isSuccessful) {
                    response.close()
                    Log.e(TAG, "HTTP ${response.code} for $url")
                    return null
                }
                return response.body ?: run { Log.e(TAG, "Null body for $url"); null }
            } catch (e: Exception) {
                val backoff = (1L shl attempt) * 1000L
                Log.w(TAG, "Request failed (attempt ${attempt + 1}), retrying in ${backoff}ms", e)
                delay(backoff)
            }
        }
        return null
    }

    private fun writeBatch(batch: List<ProgramData>): Int = writeProgramsToRealm(batch)

    private fun scheduleBackgroundSync(
        epgUrl: String,
        playlistId: String,
        channelsJson: String,
        datasetSignature: String?
    ) {
        // WorkManager Data has a hard 10240-byte limit. Persist the (potentially
        // huge) channels JSON to a file and pass only the path through the bundle.
        val cacheDir = java.io.File(reactApplicationContext.cacheDir, "epg_sync")
        cacheDir.mkdirs()
        val channelsFile = java.io.File(cacheDir, "channels_${playlistId}_${epgUrl.hashCode()}.json")
        try {
            channelsFile.writeText(channelsJson)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to persist channelsJson for background sync", e)
            return
        }

        // datasetSignature encodes all channel IDs joined with "|" and can easily
        // exceed WorkManager's 10 KB Data limit for large playlists. Store only a
        // compact hash — it is only used for cache-invalidation comparison.
        val sigHash = datasetSignature?.hashCode()?.toString() ?: ""
        val input = workDataOf(
            "epgUrl"           to epgUrl,
            "playlistId"       to playlistId,
            "channelsPath"     to channelsFile.absolutePath,
            "datasetSignature" to sigHash
        )
        val work = PeriodicWorkRequestBuilder<EpgSyncWorker>(SYNC_HOURS, TimeUnit.HOURS, 15, TimeUnit.MINUTES)
            .setInitialDelay(SYNC_HOURS, TimeUnit.HOURS)
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .setInputData(input)
            .addTag("epg_sync")
            .addTag("playlist_$playlistId")
            .build()

        WorkManager.getInstance(reactApplicationContext)
            .enqueueUniquePeriodicWork(workName(playlistId, epgUrl), ExistingPeriodicWorkPolicy.UPDATE, work)

        Log.d(TAG, "Scheduled background sync for $playlistId every ${SYNC_HOURS}h")
    }

    private fun workName(playlistId: String, epgUrl: String) =
        "epg_sync_${playlistId}_${epgUrl.hashCode()}"

    private fun cancelStaleBackgroundSyncs(playlistId: String) {
        synchronized(syncLock) {
            if (scheduledPlaylistId == playlistId) return
            WorkManager.getInstance(reactApplicationContext).cancelAllWorkByTag("epg_sync")
            scheduledPlaylistId = playlistId
        }
    }

    private fun sendEvent(name: String, params: WritableMap) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(name, params)
    }

    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
        scope.cancel()
    }
}
