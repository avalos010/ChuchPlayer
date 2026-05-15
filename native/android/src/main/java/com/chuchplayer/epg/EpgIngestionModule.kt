package com.chuchplayer.epg

import android.util.Log
import androidx.work.*
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import kotlinx.coroutines.*
import okhttp3.*
import java.util.concurrent.TimeUnit

class EpgIngestionModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    companion object {
        private const val TAG            = "EpgIngestionModule"
        private const val EVENT_PROGRESS = "EPG_INGESTION_PROGRESS"
        private const val EVENT_COMPLETE = "EPG_INGESTION_COMPLETE"
        private const val EVENT_ERROR    = "EPG_INGESTION_ERROR"
        private const val SYNC_HOURS     = 4L
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
        Log.d(TAG, "startIngestion: playlist=$playlistId url=$epgUrl")

        scope.launch {
            try {
                val channelIndex = parseChannelsJson(channelsJson)
                Log.d(TAG, "Channel index built: ${channelIndex.size} entries")

                val body = fetchWithRetry(epgUrl) { event, map -> sendEvent(event, map) }
                    ?: run {
                        promise.reject("FETCH_ERROR", "Failed to fetch EPG after retries")
                        return@launch
                    }

                val programs = parseXmlStream(body.byteStream(), playlistId, channelIndex)
                Log.d(TAG, "Parsed ${programs.size} matching programs")

                var written = 0
                programs.chunked(BATCH_SIZE).forEach { batch ->
                    written += writeBatch(batch)
                    sendEvent(EVENT_PROGRESS, Arguments.createMap().apply {
                        putInt("programsProcessed", written)
                        putString("epgUrl", epgUrl)
                    })
                }

                if (!datasetSignature.isNullOrEmpty()) {
                    updatePlaylistMetadata(playlistId, datasetSignature)
                }

                sendEvent(EVENT_COMPLETE, Arguments.createMap().apply {
                    putInt("programsCount", written)
                    putString("epgUrl", epgUrl)
                })

                scheduleBackgroundSync(epgUrl, playlistId, channelsJson, datasetSignature)

                promise.resolve(written)
            } catch (t: Throwable) {
                val msg = "Ingestion failed: ${t.message}"
                Log.e(TAG, msg, t)
                sendEvent(EVENT_ERROR, Arguments.createMap().apply {
                    putString("error", msg)
                    putString("epgUrl", epgUrl)
                })
                try { promise.reject("INGESTION_ERROR", msg) } catch (_: Exception) {}
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
                val now = System.currentTimeMillis()
                val lowerBound = now - HOURS_BEFORE * 3_600_000L
                val upperBound = now + HOURS_AFTER * 3_600_000L

                val realm = openRealm()
                try {
                    val result = Arguments.createMap()
                    ids.forEach { channelId ->
                        val programs = realm.where(ProgramRealm::class.java)
                            .equalTo("playlistId", playlistId)
                            .equalTo("channelId", channelId)
                            .greaterThan("end", java.util.Date(lowerBound))
                            .lessThan("start", java.util.Date(upperBound))
                            .findAll()

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
                        result.putArray(channelId, arr)
                    }
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
        url: String,
        onEvent: (String, WritableMap) -> Unit
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

    private fun writeBatch(batch: List<ProgramData>): Int {
        if (batch.isEmpty()) return 0
        var count = 0
        val realm = openRealm()
        try {
            realm.executeTransaction { r ->
                batch.forEach { prog ->
                    val pk = "${prog.playlistId}|${prog.channelId}|${prog.start}|${prog.end}|${prog.title}"
                    if (r.where(ProgramRealm::class.java).equalTo("id", pk).findFirst() == null) {
                        r.createObject(ProgramRealm::class.java, pk).apply {
                            playlistId   = prog.playlistId
                            channelId    = prog.channelId
                            title        = prog.title
                            description  = prog.description
                            start        = java.util.Date(prog.start)
                            end          = java.util.Date(prog.end)
                            epgChannelId = prog.epgChannelId
                            createdAt    = java.util.Date()
                        }
                        count++
                    }
                }
            }
        } finally {
            realm.close()
        }
        return count
    }

    private fun scheduleBackgroundSync(
        epgUrl: String,
        playlistId: String,
        channelsJson: String,
        datasetSignature: String?
    ) {
        val input = workDataOf(
            "epgUrl"           to epgUrl,
            "playlistId"       to playlistId,
            "channelsJson"     to channelsJson,
            "datasetSignature" to (datasetSignature ?: "")
        )
        val work = PeriodicWorkRequestBuilder<EpgSyncWorker>(SYNC_HOURS, TimeUnit.HOURS, 15, TimeUnit.MINUTES)
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
