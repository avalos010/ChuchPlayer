package com.chuchplayer.epg

import android.content.Context
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import io.realm.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.*
import org.xmlpull.v1.XmlPullParserFactory
import java.io.InputStream
import java.util.*

/**
 * WorkManager worker that periodically fetches and ingests EPG data
 * Runs every 4 hours automatically
 */
class EpgSyncWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    companion object {
        private const val TAG = "EpgSyncWorker"
        private const val PREF_NAME = "epg_sync_prefs"
        private const val KEY_LAST_SYNC = "last_sync_"
        private const val SYNC_INTERVAL_HOURS = 4L
        private const val SYNC_INTERVAL_MS = SYNC_INTERVAL_HOURS * 60 * 60 * 1000
        private const val MIN_DELAY_BETWEEN_REQUESTS_MS = 2000L // 2 seconds between requests
        private const val BATCH_SIZE = 2000
    }

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        try {
            val epgUrl = inputData.getString("epgUrl") ?: return@withContext Result.failure()
            val playlistId = inputData.getString("playlistId") ?: return@withContext Result.failure()
            val channelsJson = inputData.getString("channelsJson") ?: return@withContext Result.failure()
            val datasetSignatureStr = inputData.getString("datasetSignature")
            val datasetSignature = if (datasetSignatureStr.isNullOrEmpty()) null else datasetSignatureStr

            Log.d(TAG, "Starting periodic EPG sync for playlist: $playlistId, URL: $epgUrl")

            // Check if we need to sync (4 hours since last sync)
            val lastSyncKey = KEY_LAST_SYNC + playlistId + "_" + epgUrl.hashCode()
            val prefs = applicationContext.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
            val lastSyncTime = prefs.getLong(lastSyncKey, 0)
            val now = System.currentTimeMillis()

            if (lastSyncTime > 0 && (now - lastSyncTime) < SYNC_INTERVAL_MS) {
                val hoursSinceLastSync = (now - lastSyncTime) / (60 * 60 * 1000)
                Log.d(TAG, "Skipping sync - only $hoursSinceLastSync hours since last sync (need $SYNC_INTERVAL_HOURS hours)")
                return@withContext Result.success()
            }

            // Parse channels
            val channelIndex = parseChannelsJson(channelsJson)
            Log.d(TAG, "Parsed ${channelIndex.size} channels for matching")

            // Fetch EPG data with rate limiting and retry logic
            val client = OkHttpClient.Builder()
                .readTimeout(120, java.util.concurrent.TimeUnit.SECONDS)
                .build()

            val request = Request.Builder()
                .url(epgUrl)
                .header("User-Agent", "chuchPlayer/1.0")
                .header("Accept", "application/xml, text/xml, */*")
                .build()

            // Retry logic with exponential backoff for rate limiting
            var response: okhttp3.Response? = null
            var retryCount = 0
            val maxRetries = 3
            
            while (retryCount <= maxRetries) {
                try {
                    response = client.newCall(request).execute()
                    
                    // Handle 429 (Too Many Requests) with retry
                    if (response.code == 429) {
                        response.close()
                        val retryAfter = response.header("Retry-After")?.toLongOrNull() ?: (1L shl retryCount) * 60 // Exponential backoff in minutes: 1min, 2min, 4min
                        
                        if (retryCount < maxRetries) {
                            Log.w(TAG, "Rate limited (429), will retry later (attempt ${retryCount + 1}/${maxRetries})")
                            // For WorkManager, return retry() to reschedule
                            return@withContext Result.retry()
                        } else {
                            Log.e(TAG, "Rate limited (429), max retries exceeded - skipping this sync")
                            // Update last sync time to prevent immediate retry
                            prefs.edit().putLong(lastSyncKey, now).apply()
                            return@withContext Result.success() // Don't retry, wait for next scheduled run
                        }
                    }
                    
                    // Break if successful or non-retryable error
                    break
                } catch (e: Exception) {
                    if (retryCount < maxRetries) {
                        val backoffMs = (1L shl retryCount) * 60 * 1000 // Exponential backoff in minutes
                        Log.w(TAG, "Request failed, will retry later (attempt ${retryCount + 1}/${maxRetries})", e)
                        retryCount++
                        return@withContext Result.retry()
                    } else {
                        Log.e(TAG, "Request failed after max retries", e)
                        return@withContext Result.retry()
                    }
                }
            }

            val finalResponse = response ?: return@withContext Result.retry()

            if (!finalResponse.isSuccessful) {
                finalResponse.close()
                val error = "HTTP ${finalResponse.code}: ${finalResponse.message}"
                Log.e(TAG, error)
                return@withContext Result.retry()
            }

            val body = finalResponse.body ?: run {
                finalResponse.close()
                Log.e(TAG, "Response body is null")
                return@withContext Result.retry()
            }

            // Parse and ingest
            val programs = parseXmlStream(body.byteStream(), playlistId, channelIndex, epgUrl)
            Log.d(TAG, "Parsed ${programs.size} programs from XML, writing to Realm...")

            val inserted = writeProgramsToRealm(programs, epgUrl)
            Log.d(TAG, "Inserted $inserted programs into Realm")

            // Update metadata if signature provided
            if (datasetSignature != null) {
                updatePlaylistMetadata(playlistId, datasetSignature)
            }

            // Update last sync time
            prefs.edit().putLong(lastSyncKey, now).apply()
            Log.d(TAG, "EPG sync completed successfully")

            Result.success()
        } catch (e: Exception) {
            Log.e(TAG, "EPG sync failed", e)
            Result.retry()
        }
    }

    private fun getRealmInstance(): Realm {
        val config = RealmConfiguration.Builder()
            .name("default.realm")
            .schemaVersion(1)
            .build()
        return Realm.getInstance(config)
    }

    private fun parseChannelsJson(channelsJson: String): Map<String, ChannelInfo> {
        val channelIndex = mutableMapOf<String, ChannelInfo>()
        try {
            val jsonArray = org.json.JSONArray(channelsJson)
            for (i in 0 until jsonArray.length()) {
                val channelObj = jsonArray.getJSONObject(i)
                val id = channelObj.getString("id")
                val name = channelObj.getString("name")
                val tvgId = channelObj.optString("tvgId", null)

                val channelInfo = ChannelInfo(id, name, tvgId)
                if (tvgId != null && tvgId.isNotEmpty()) {
                    val keys = normalizeKeyVariants(tvgId)
                    keys.forEach { key -> channelIndex[key] = channelInfo }
                }
                // Also index by channel name
                val nameKeys = normalizeKeyVariants(name)
                nameKeys.forEach { key -> if (!channelIndex.containsKey(key)) channelIndex[key] = channelInfo }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to parse channels JSON", e)
        }
        return channelIndex
    }

    private fun normalizeKeyVariants(value: String): List<String> {
        val trimmed = value.trim()
        val variants = mutableListOf<String>()
        variants.add(trimmed.lowercase())
        variants.add(trimmed.lowercase().replace(" ", ""))
        variants.add(trimmed.lowercase().replace("-", ""))
        variants.add(trimmed.lowercase().replace("_", ""))
        variants.add(trimmed.lowercase().replace(Regex("[^a-z0-9]"), ""))
        return variants.distinct()
    }

    private fun parseXmlStream(
        inputStream: InputStream,
        playlistId: String,
        channelIndex: Map<String, ChannelInfo>,
        epgUrl: String
    ): List<ProgramData> {
        val programs = mutableListOf<ProgramData>()
        val factory = XmlPullParserFactory.newInstance()
        factory.isNamespaceAware = false
        val parser = factory.newPullParser()
        parser.setInput(inputStream, "UTF-8")

        val now = System.currentTimeMillis()
        val lowerBound = now - (12 * 60 * 60 * 1000) // 12 hours before
        val upperBound = now + (36 * 60 * 60 * 1000) // 36 hours after

        var currentProgram: ProgramBuilder? = null
        var currentText = StringBuilder()

        var eventType = parser.eventType
        while (eventType != org.xmlpull.v1.XmlPullParser.END_DOCUMENT) {
            when (eventType) {
                org.xmlpull.v1.XmlPullParser.START_TAG -> {
                    currentText.clear()
                    when (parser.name) {
                        "programme" -> {
                            val channelAttr = parser.getAttributeValue(null, "channel") ?: ""
                            val startStr = parser.getAttributeValue(null, "start") ?: ""
                            val stopStr = parser.getAttributeValue(null, "stop") ?: ""

                            currentProgram = ProgramBuilder(playlistId, channelIndex, ::normalizeKeyVariants).apply {
                                epgChannelId = channelAttr
                                start = startStr
                                stop = stopStr
                            }
                        }
                    }
                }
                org.xmlpull.v1.XmlPullParser.TEXT -> {
                    currentText.append(parser.text)
                }
                org.xmlpull.v1.XmlPullParser.END_TAG -> {
                    when (parser.name) {
                        "title" -> currentProgram?.title = currentText.toString().trim()
                        "desc" -> currentProgram?.description = currentText.toString().trim()
                        "programme" -> {
                            currentProgram?.build(lowerBound, upperBound)?.let { programs.add(it) }
                            currentProgram = null
                        }
                    }
                    currentText.clear()
                }
            }
            eventType = parser.next()
        }

        return programs
    }

    private suspend fun writeProgramsToRealm(programs: List<ProgramData>, epgUrl: String): Int {
        if (programs.isEmpty()) return 0

        val realm = getRealmInstance()
        var totalInserted = 0

        try {
            programs.chunked(BATCH_SIZE).forEach { batch ->
                realm.executeTransaction { transactionRealm ->
                    batch.forEach { program ->
                        val primaryKey = "${program.playlistId}|${program.channelId}|${program.start}|${program.end}|${program.title}"
                        val existing = transactionRealm.where(ProgramRealm::class.java)
                            .equalTo("id", primaryKey)
                            .findFirst()

                        if (existing == null) {
                            val programRealm = transactionRealm.createObject(ProgramRealm::class.java, primaryKey)
                            programRealm.playlistId = program.playlistId
                            programRealm.channelId = program.channelId
                            programRealm.title = program.title
                            programRealm.description = program.description
                            programRealm.start = Date(program.start)
                            programRealm.end = Date(program.end)
                            programRealm.epgChannelId = program.epgChannelId
                            programRealm.createdAt = Date()
                            totalInserted++
                        }
                    }
                }
            }
        } finally {
            realm.close()
        }

        return totalInserted
    }

    private suspend fun updatePlaylistMetadata(playlistId: String, datasetSignature: String) {
        val realm = getRealmInstance()
        try {
            realm.executeTransaction { transactionRealm ->
                val metadata = transactionRealm.where(MetadataRealm::class.java)
                    .equalTo("playlistId", playlistId)
                    .findFirst()

                if (metadata != null) {
                    metadata.lastUpdated = Date()
                    metadata.sourceSignature = datasetSignature
                } else {
                    val newMetadata = transactionRealm.createObject(MetadataRealm::class.java, playlistId)
                    newMetadata.lastUpdated = Date()
                    newMetadata.sourceSignature = datasetSignature
                }
            }
        } finally {
            realm.close()
        }
    }
}

