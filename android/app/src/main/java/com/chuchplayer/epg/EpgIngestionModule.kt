package com.chuchplayer.epg

import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import kotlinx.coroutines.*
import okhttp3.*
import org.json.JSONArray
import org.xmlpull.v1.XmlPullParser
import org.xmlpull.v1.XmlPullParserFactory
import java.io.InputStream
import java.util.*

class EpgIngestionModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    private val coroutineScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    
    companion object {
        private const val TAG = "EpgIngestionModule"
        private const val EVENT_PROGRESS = "EPG_INGESTION_PROGRESS"
        private const val EVENT_COMPLETE = "EPG_INGESTION_COMPLETE"
        private const val EVENT_ERROR = "EPG_INGESTION_ERROR"
        private const val HOURS_BEFORE = 12
        private const val HOURS_AFTER = 36
    }

    override fun getName(): String = "EpgIngestionModule"

    @ReactMethod
    fun startIngestion(
        epgUrl: String,
        playlistId: String,
        channelsJson: String,
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
                
                val request = Request.Builder()
                    .url(epgUrl)
                    .build()
                
                val response = client.newCall(request).execute()
                
                if (!response.isSuccessful) {
                    val error = "HTTP ${response.code}: ${response.message}"
                    Log.e(TAG, error)
                    sendEvent(EVENT_ERROR, createErrorMap(error))
                    promise.reject("HTTP_ERROR", error)
                    return@launch
                }
                
                val body = response.body ?: run {
                    val error = "Response body is null"
                    sendEvent(EVENT_ERROR, createErrorMap(error))
                    promise.reject("NO_BODY", error)
                    return@launch
                }
                
                val programs = parseXmlStream(body.byteStream(), playlistId, channelIndex)
                
                Log.d(TAG, "Parsed ${programs.size} programs from XML")
                sendEvent(EVENT_COMPLETE, createSuccessMap(programs.size))
                promise.resolve(createProgramsArray(programs))
                
            } catch (e: Exception) {
                val error = "Ingestion failed: ${e.message}"
                Log.e(TAG, error, e)
                sendEvent(EVENT_ERROR, createErrorMap(error))
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
        channelIndex: Map<String, ChannelInfo>
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
                            val epgChannelId = parser.getAttributeValue(null, "channel") ?: ""
                            val startStr = parser.getAttributeValue(null, "start") ?: ""
                            val stopStr = parser.getAttributeValue(null, "stop") ?: ""
                            
                            currentProgram = ProgramBuilder(playlistId, channelIndex, ::normalizeKey).apply {
                                epgChannelId = epgChannelId
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
                                        sendEvent(EVENT_PROGRESS, createProgressMap(programsMatched))
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
    
    private fun createProgressMap(count: Int): WritableMap {
        return Arguments.createMap().apply {
            putInt("programsProcessed", count)
        }
    }
    
    private fun createSuccessMap(count: Int): WritableMap {
        return Arguments.createMap().apply {
            putInt("programsCount", count)
        }
    }
    
    private fun createErrorMap(message: String): WritableMap {
        return Arguments.createMap().apply {
            putString("error", message)
        }
    }
    
    private fun createProgramsArray(programs: List<ProgramData>): WritableArray {
        return Arguments.createArray().apply {
            programs.forEach { program ->
                val map = Arguments.createMap().apply {
                    putString("playlistId", program.playlistId)
                    putString("channelId", program.channelId)
                    putString("title", program.title)
                    program.description?.let { putString("description", it) }
                    putDouble("start", program.start.toDouble())
                    putDouble("end", program.end.toDouble())
                    program.epgChannelId?.let { putString("epgChannelId", it) }
                }
                pushMap(map)
            }
        }
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

