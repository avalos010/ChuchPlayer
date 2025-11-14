package com.chuchplayer.epg

import android.content.Context
import android.util.Log
import androidx.work.*
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import io.realm.*
import kotlinx.coroutines.*
import okhttp3.*
import org.json.JSONArray
import org.xmlpull.v1.XmlPullParser
import org.xmlpull.v1.XmlPullParserFactory
import java.io.File
import java.io.InputStream
import java.util.*
import java.util.concurrent.TimeUnit

class EpgIngestionModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    private val coroutineScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val reactContext = reactContext
    
    companion object {
        private const val TAG = "EpgIngestionModule"
        private const val EVENT_PROGRESS = "EPG_INGESTION_PROGRESS"
        private const val EVENT_COMPLETE = "EPG_INGESTION_COMPLETE"
        private const val EVENT_ERROR = "EPG_INGESTION_ERROR"
        private const val HOURS_BEFORE = 12
        private const val HOURS_AFTER = 36
        private const val BATCH_SIZE = 2000
        private const val SYNC_INTERVAL_HOURS = 4L
        private const val WORK_NAME_PREFIX = "epg_sync_"
    }

    override fun getName(): String = "EpgIngestionModule"
    
    private fun getRealmInstance(): Realm {
        // Realm JS stores database in app's files directory
        // Default Realm path matches what Realm JS uses
        // Realm Java SDK 10.x auto-discovers RealmObject classes
        val config = RealmConfiguration.Builder()
            .name("default.realm")
            .schemaVersion(1)
            .build()
        return Realm.getInstance(config)
    }
    
    private fun buildProgramPrimaryKey(program: ProgramData): String {
        return "${program.playlistId}|${program.channelId}|${program.start}|${program.end}|${program.title}"
    }

    @ReactMethod
    fun startIngestion(
        epgUrl: String,
        playlistId: String,
        channelsJson: String,
        datasetSignature: String?,
        promise: Promise
    ) {
        Log.d(TAG, "Starting EPG ingestion for playlist: $playlistId, URL: $epgUrl")
        
        coroutineScope.launch {
            try {
                // Parse channels JSON
                val channelIndex = parseChannelsJson(channelsJson)
                Log.d(TAG, "Parsed ${channelIndex.size} channels for matching")
                
                val client = OkHttpClient.Builder()
                    .readTimeout(120, java.util.concurrent.TimeUnit.SECONDS)
                    .build()
                
                // Add User-Agent and rate limiting headers
                val request = Request.Builder()
                    .url(epgUrl)
                    .header("User-Agent", "chuchPlayer/1.0")
                    .header("Accept", "application/xml, text/xml, */*")
                    .build()
                
                // Retry logic with exponential backoff for rate limiting
                var response: okhttp3.Response? = null
                var retryCount = 0
                val maxRetries = 3
                var lastException: Exception? = null
                
                while (retryCount <= maxRetries) {
                    try {
                        response = client.newCall(request).execute()
                        
                        // Handle 429 (Too Many Requests) with retry
                        if (response.code == 429) {
                            response.close()
                            val retryAfter = response.header("Retry-After")?.toLongOrNull() ?: (1L shl retryCount) // Exponential backoff: 1s, 2s, 4s
                            
                            if (retryCount < maxRetries) {
                                Log.w(TAG, "Rate limited (429), retrying after ${retryAfter}s (attempt ${retryCount + 1}/${maxRetries})")
                                delay(retryAfter * 1000)
                                retryCount++
                                continue
                            } else {
                                val error = "HTTP 429: Too Many Requests (max retries exceeded)"
                                Log.e(TAG, error)
                                sendEvent(EVENT_ERROR, createErrorMap(error, epgUrl))
                                promise.reject("HTTP_429", error)
                                return@launch
                            }
                        }
                        
                        // Break if successful or non-retryable error
                        break
                    } catch (e: Exception) {
                        lastException = e
                        if (retryCount < maxRetries) {
                            val backoffMs = (1L shl retryCount) * 1000 // Exponential backoff
                            Log.w(TAG, "Request failed, retrying after ${backoffMs}ms (attempt ${retryCount + 1}/${maxRetries})", e)
                            delay(backoffMs)
                            retryCount++
                        } else {
                            throw e
                        }
                    }
                }
                
                val finalResponse = response ?: throw lastException ?: Exception("No response received")
                
                if (!finalResponse.isSuccessful) {
                    val error = "HTTP ${finalResponse.code}: ${finalResponse.message}"
                    Log.e(TAG, error)
                    sendEvent(EVENT_ERROR, createErrorMap(error, epgUrl))
                    promise.reject("HTTP_ERROR", error)
                    return@launch
                }
                
                val body = finalResponse.body ?: run {
                    finalResponse.close()
                    val error = "Response body is null"
                    sendEvent(EVENT_ERROR, createErrorMap(error, epgUrl))
                    promise.reject("NO_BODY", error)
                    return@launch
                }
                
                val programs = parseXmlStream(body.byteStream(), playlistId, channelIndex, epgUrl)
                
                Log.d(TAG, "Parsed ${programs.size} programs from XML, writing to Realm...")
                
                // Write directly to Realm in batches
                val inserted = writeProgramsToRealm(programs, epgUrl)
                
                // Update metadata if signature provided
                if (datasetSignature != null) {
                    updatePlaylistMetadata(playlistId, datasetSignature)
                }
                
                Log.d(TAG, "Inserted $inserted programs into Realm")
                sendEvent(EVENT_COMPLETE, createSuccessMap(inserted, epgUrl))
                
                // Schedule periodic sync (every 4 hours)
                schedulePeriodicSync(epgUrl, playlistId, channelsJson, datasetSignature)
                
                promise.resolve(inserted)
                
            } catch (e: Exception) {
                val error = "Ingestion failed: ${e.message}"
                Log.e(TAG, error, e)
                sendEvent(EVENT_ERROR, createErrorMap(error, epgUrl))
                promise.reject("INGESTION_ERROR", error, e)
            }
        }
    }
    
    private fun parseChannelsJson(channelsJson: String): Map<String, ChannelInfo> {
        val channelIndex = mutableMapOf<String, ChannelInfo>()
        
        try {
            val jsonArray = JSONArray(channelsJson)
            for (i in 0 until jsonArray.length()) {
                val channelObj = jsonArray.getJSONObject(i)
                val id = channelObj.getString("id")
                val name = channelObj.optString("name", "")
                val tvgId = channelObj.optString("tvgId", null)
                
                val channelInfo = ChannelInfo(id, name, tvgId)
                
                // Index by tvgId (highest priority)
                tvgId?.let { 
                    normalizeKey(it).forEach { key -> channelIndex[key] = channelInfo }
                }
                
                // Index by id
                normalizeKey(id).forEach { key -> 
                    if (!channelIndex.containsKey(key)) {
                        channelIndex[key] = channelInfo
                    }
                }
                
                // Index by name (lowest priority)
                if (name.isNotEmpty() && tvgId == null) {
                    normalizeKey(name).forEach { key ->
                        if (!channelIndex.containsKey(key)) {
                            channelIndex[key] = channelInfo
                        }
                    }
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to parse channels JSON", e)
        }
        
        return channelIndex
    }
    
    private fun normalizeKey(value: String): List<String> {
        val trimmed = value.trim()
        if (trimmed.isEmpty()) return emptyList()
        
        val lower = trimmed.lowercase()
        val sanitized = lower.replace(Regex("[^a-z0-9]"), "")
        
        return if (sanitized.isNotEmpty() && sanitized != lower) {
            listOf(lower, sanitized)
        } else {
            listOf(lower)
        }
    }

    private suspend fun parseXmlStream(
        inputStream: InputStream,
        playlistId: String,
        channelIndex: Map<String, ChannelInfo>,
        epgUrl: String
    ): List<ProgramData> = withContext(Dispatchers.IO) {
        val programs = mutableListOf<ProgramData>()
        val factory = XmlPullParserFactory.newInstance()
        factory.isNamespaceAware = false
        val parser = factory.newPullParser()
        parser.setInput(inputStream, "UTF-8")
        
        val now = System.currentTimeMillis()
        val lowerBound = now - (HOURS_BEFORE * 60 * 60 * 1000)
        val upperBound = now + (HOURS_AFTER * 60 * 60 * 1000)
        
        var eventType = parser.eventType
        var currentProgram: ProgramBuilder? = null
        var currentText = StringBuilder()
        var programsProcessed = 0
        var programsMatched = 0
        
        while (eventType != XmlPullParser.END_DOCUMENT) {
            when (eventType) {
                XmlPullParser.START_TAG -> {
                    currentText.clear()
                    when (parser.name) {
                        "programme" -> {
                            val channelAttr = parser.getAttributeValue(null, "channel") ?: ""
                            val startStr = parser.getAttributeValue(null, "start") ?: ""
                            val stopStr = parser.getAttributeValue(null, "stop") ?: ""
                            
                            currentProgram = ProgramBuilder(playlistId, channelIndex, ::normalizeKey).apply {
                                epgChannelId = channelAttr
                                start = startStr
                                stop = stopStr
                            }
                        }
                        "title" -> {
                            // Will be handled in END_TAG
                        }
                        "desc" -> {
                            // Will be handled in END_TAG
                        }
                    }
                }
                XmlPullParser.TEXT -> {
                    currentText.append(parser.text)
                }
                XmlPullParser.END_TAG -> {
                    when (parser.name) {
                        "title" -> {
                            currentProgram?.title = currentText.toString().trim()
                        }
                        "desc" -> {
                            currentProgram?.description = currentText.toString().trim()
                        }
                        "programme" -> {
                            programsProcessed++
                            currentProgram?.let { builder ->
                                val program = builder.build(lowerBound, upperBound)
                                if (program != null) {
                                    programs.add(program)
                                    programsMatched++
                                    
                                    // Send progress every 1000 programs
                                    if (programsMatched % 1000 == 0) {
                                        sendEvent(EVENT_PROGRESS, createProgressMap(programsMatched, epgUrl))
                                    }
                                }
                            }
                            currentProgram = null
                        }
                    }
                    currentText.clear()
                }
            }
            eventType = parser.next()
        }
        
        Log.d(TAG, "Processed $programsProcessed programs, matched $programsMatched to channels")
        programs
    }
    
    private fun sendEvent(eventName: String, params: WritableMap) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }
    
    private fun createProgressMap(count: Int, epgUrl: String): WritableMap {
        return Arguments.createMap().apply {
            putInt("programsProcessed", count)
            putString("epgUrl", epgUrl)
        }
    }
    
    private fun createSuccessMap(count: Int, epgUrl: String): WritableMap {
        return Arguments.createMap().apply {
            putInt("programsCount", count)
            putString("epgUrl", epgUrl)
        }
    }
    
    private fun createErrorMap(message: String, epgUrl: String? = null): WritableMap {
        return Arguments.createMap().apply {
            putString("error", message)
            if (epgUrl != null) {
                putString("epgUrl", epgUrl)
            }
        }
    }
    
    private suspend fun writeProgramsToRealm(programs: List<ProgramData>, epgUrl: String): Int = withContext(Dispatchers.IO) {
        if (programs.isEmpty()) {
            return@withContext 0
        }
        
        val realm = getRealmInstance()
        var totalInserted = 0
        
        try {
            // Write in batches to avoid blocking
            programs.chunked(BATCH_SIZE).forEachIndexed { batchIndex, batch ->
                realm.executeTransaction { transactionRealm ->
                    batch.forEach { program ->
                        val primaryKey = buildProgramPrimaryKey(program)
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
                
                // Send progress every 1000 programs
                val processed = (batchIndex + 1) * BATCH_SIZE
                if (processed % 1000 == 0 || batchIndex == programs.chunked(BATCH_SIZE).size - 1) {
                    sendEvent(EVENT_PROGRESS, createProgressMap(processed.coerceAtMost(programs.size), epgUrl))
                }
                
                // Yield to allow other operations
                delay(0)
            }
        } finally {
            realm.close()
        }
        
        totalInserted
    }
    
    private suspend fun updatePlaylistMetadata(playlistId: String, datasetSignature: String) = withContext(Dispatchers.IO) {
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
    
    @ReactMethod
    fun schedulePeriodicSync(
        epgUrl: String,
        playlistId: String,
        channelsJson: String,
        datasetSignature: String?,
        promise: Promise
    ) {
        try {
            schedulePeriodicSync(epgUrl, playlistId, channelsJson, datasetSignature)
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to schedule periodic sync", e)
            promise.reject("SCHEDULE_ERROR", "Failed to schedule periodic sync: ${e.message}", e)
        }
    }

    @ReactMethod
    fun cancelPeriodicSync(playlistId: String, epgUrl: String, promise: Promise) {
        try {
            val workName = getWorkName(playlistId, epgUrl)
            WorkManager.getInstance(reactApplicationContext).cancelUniqueWork(workName)
            Log.d(TAG, "Cancelled periodic sync for $playlistId - $epgUrl")
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to cancel periodic sync", e)
            promise.reject("CANCEL_ERROR", "Failed to cancel periodic sync: ${e.message}", e)
        }
    }

    private fun schedulePeriodicSync(
        epgUrl: String,
        playlistId: String,
        channelsJson: String,
        datasetSignature: String?
    ) {
        val workName = getWorkName(playlistId, epgUrl)
        val workManager = WorkManager.getInstance(reactApplicationContext)

        // Create input data
        val inputData = workDataOf(
            "epgUrl" to epgUrl,
            "playlistId" to playlistId,
            "channelsJson" to channelsJson,
            "datasetSignature" to (datasetSignature ?: "")
        )

        // Create constraints (network required)
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        // Create periodic work request (every 4 hours, with 15 minute flex window)
        val periodicWork = PeriodicWorkRequestBuilder<EpgSyncWorker>(
            SYNC_INTERVAL_HOURS,
            TimeUnit.HOURS,
            15,
            TimeUnit.MINUTES
        )
            .setConstraints(constraints)
            .setInputData(inputData)
            .addTag("epg_sync")
            .addTag("playlist_$playlistId")
            .build()

        // Enqueue unique work (replaces existing work with same name)
        workManager.enqueueUniquePeriodicWork(
            workName,
            ExistingPeriodicWorkPolicy.REPLACE,
            periodicWork
        )

        Log.d(TAG, "Scheduled periodic EPG sync for $playlistId - $epgUrl (every $SYNC_INTERVAL_HOURS hours)")
    }

    private fun getWorkName(playlistId: String, epgUrl: String): String {
        return WORK_NAME_PREFIX + playlistId + "_" + epgUrl.hashCode()
    }

    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
        coroutineScope.cancel()
    }
}

data class ProgramData(
    val playlistId: String,
    val channelId: String,
    val title: String,
    val description: String?,
    val start: Long,
    val end: Long,
    val epgChannelId: String?
)

data class ChannelInfo(
    val id: String,
    val name: String,
    val tvgId: String?
)

class ProgramBuilder(
    private val playlistId: String,
    private val channelIndex: Map<String, ChannelInfo>,
    private val normalizeKey: (String) -> List<String>
) {
    companion object {
        private const val TAG = "ProgramBuilder"
    }
    
    var epgChannelId: String = ""
    var start: String = ""
    var stop: String = ""
    var title: String = ""
    var description: String? = null
    
    fun build(lowerBound: Long, upperBound: Long): ProgramData? {
        // Match channel
        val channelInfo = matchChannel(epgChannelId) ?: return null
        
        // Parse dates
        val startTime = parseXmltvDate(start) ?: return null
        val endTime = parseXmltvDate(stop) ?: startTime + (60 * 60 * 1000) // Default 1 hour
        
        // Filter by time window
        if (endTime < lowerBound || startTime > upperBound) {
            return null
        }
        
        return ProgramData(
            playlistId = playlistId,
            channelId = channelInfo.id,
            title = title.ifEmpty { "Untitled" },
            description = description,
            start = startTime,
            end = endTime,
            epgChannelId = epgChannelId
        )
    }
    
    private fun matchChannel(epgChannelId: String): ChannelInfo? {
        if (epgChannelId.isEmpty()) return null
        
        val keys = normalizeKey(epgChannelId)
        for (key in keys) {
            channelIndex[key]?.let { return it }
        }
        
        return null
    }
    
    private fun parseXmltvDate(dateStr: String): Long? {
        if (dateStr.isEmpty()) return null
        
        return try {
            // Handle formats like: 20240101120000 +0000 or 20240101120000+0000
            val cleaned = dateStr.trim().replace(" ", "")
            
            // Extract timezone offset if present
            val timezonePattern = Regex("([+-]\\d{4}|Z)$")
            val timezoneMatch = timezonePattern.find(cleaned)
            val hasTimezone = timezoneMatch != null
            
            // Remove timezone from date string
            val dateOnly = if (hasTimezone) {
                cleaned.substring(0, cleaned.length - timezoneMatch!!.value.length)
            } else {
                cleaned
            }
            
            if (dateOnly.length < 14) return null
            
            val year = dateOnly.substring(0, 4).toInt()
            val month = dateOnly.substring(4, 6).toInt() - 1
            val day = dateOnly.substring(6, 8).toInt()
            val hour = dateOnly.substring(8, 10).toInt()
            val minute = dateOnly.substring(10, 12).toInt()
            val second = if (dateOnly.length >= 14) dateOnly.substring(12, 14).toInt() else 0
            
            // Parse timezone
            val timezone = if (hasTimezone && timezoneMatch != null) {
                val tzStr = timezoneMatch.value
                if (tzStr == "Z") {
                    TimeZone.getTimeZone("UTC")
                } else {
                    val sign = if (tzStr[0] == '+') 1 else -1
                    val hours = tzStr.substring(1, 3).toInt()
                    val minutes = tzStr.substring(3, 5).toInt()
                    val offsetMs = sign * (hours * 60 + minutes) * 60 * 1000
                    TimeZone.getTimeZone("GMT${if (sign > 0) "+" else "-"}${String.format("%02d:%02d", hours, minutes)}")
                }
            } else {
                TimeZone.getTimeZone("UTC")
            }
            
            val calendar = Calendar.getInstance(timezone)
            calendar.set(year, month, day, hour, minute, second)
            calendar.set(Calendar.MILLISECOND, 0)
            calendar.timeInMillis
        } catch (e: Exception) {
            Log.w(TAG, "Failed to parse date: $dateStr", e)
            null
        }
    }
}

