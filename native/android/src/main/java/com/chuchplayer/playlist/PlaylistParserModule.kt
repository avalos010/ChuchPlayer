package com.chuchplayer.playlist

import android.util.Log
import com.facebook.react.bridge.*
import kotlinx.coroutines.*
import java.io.BufferedReader
import java.io.StringReader

class PlaylistParserModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
  private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

  companion object {
    private const val TAG = "PlaylistParserModule"
    private const val EVENT_PROGRESS = "M3U_PARSE_PROGRESS"
  }

  override fun getName() = "PlaylistParserModule"

  @ReactMethod
  fun parseM3U(content: String, promise: Promise) {
    scope.launch {
      try {
        val channels = parseM3UContent(content)
        val arr = Arguments.createArray()
        channels.forEach { arr.pushMap(it) }

        Log.d(TAG, "Parsed ${channels.size} channels from M3U")
        sendEvent(EVENT_PROGRESS, Arguments.createMap().apply {
          putInt("count", channels.size)
        })

        promise.resolve(arr)
      } catch (t: Throwable) {
        Log.e(TAG, "parseM3U failed: ${t.message}", t)
        promise.reject("PARSE_ERROR", t.message)
      }
    }
  }

  private suspend fun parseM3UContent(content: String): List<WritableMap> {
    return withContext(Dispatchers.IO) {
      val channels = mutableListOf<WritableMap>()
      val reader = BufferedReader(StringReader(content))

      var currentTvgId = ""
      var currentTvgName = ""
      var currentTvgLogo = ""
      var currentGroup = "Uncategorized"
      var lineNum = 0

      reader.use { r ->
        var line: String?
        while (r.readLine().also { line = it } != null) {
          lineNum++
          line = line!!.trim()

          // Parse EXTINF line: #EXTINF:-1 tvg-id="..." tvg-name="..." tvg-logo="..." group-title="..."
          if (line!!.startsWith("#EXTINF:")) {
            currentTvgId = extractAttribute(line!!, "tvg-id")
            currentTvgName = extractAttribute(line!!, "tvg-name")
            currentTvgLogo = extractAttribute(line!!, "tvg-logo")
            currentGroup = extractAttribute(line!!, "group-title").ifEmpty { "Uncategorized" }

            // Extract display name from trailing comma-delimited part
            val displayName = line!!.substringAfterLast(",").trim()
            if (displayName.isNotEmpty() && currentTvgName.isEmpty()) {
              currentTvgName = displayName
            }
          } else if (!line!!.startsWith("#") && line!!.isNotEmpty()) {
            // This is a stream URL
            val url = line!!
            if (currentTvgName.isNotEmpty()) {
              channels.add(Arguments.createMap().apply {
                putString("id", currentTvgId.ifEmpty { "channel-${System.currentTimeMillis()}-${channels.size}" })
                putString("name", currentTvgName)
                putString("url", url)
                putString("logo", currentTvgLogo)
                putString("group", currentGroup)
                putString("tvgId", currentTvgId)
              })
            }

            // Reset for next entry
            currentTvgId = ""
            currentTvgName = ""
            currentTvgLogo = ""
            currentGroup = "Uncategorized"
          }

          // Yield to avoid blocking
          if (lineNum % 100 == 0) {
            yield()
          }
        }
      }

      channels
    }
  }

  private fun extractAttribute(line: String, attributeName: String): String {
    // Match: attributeName="value" or attributeName='value'
    val pattern = """$attributeName\s*=\s*["']([^"']*)["']""".toRegex(RegexOption.IGNORE_CASE)
    return pattern.find(line)?.groupValues?.get(1) ?: ""
  }

  private fun sendEvent(eventName: String, params: WritableMap) {
    try {
      reactApplicationContext
        .getJSModule(com.facebook.react.modules.core.DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit(eventName, params)
    } catch (e: Exception) {
      Log.w(TAG, "Failed to send event: ${e.message}")
    }
  }

  override fun onCatalystInstanceDestroy() {
    super.onCatalystInstanceDestroy()
    scope.cancel()
  }
}
