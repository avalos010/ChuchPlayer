package com.chuchplayer.playlist

import android.util.Log
import android.util.JsonReader
import android.util.JsonToken
import com.facebook.react.bridge.*
import kotlinx.coroutines.*
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.StringReader
import java.util.concurrent.TimeUnit

class PlaylistParserModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
  private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
  private val httpClient = OkHttpClient.Builder()
    .followRedirects(true)
    .followSslRedirects(true)
    .connectTimeout(30, TimeUnit.SECONDS)
    .readTimeout(120, TimeUnit.SECONDS)
    .build()

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

  @ReactMethod
  fun fetchXtreamVod(serverUrl: String, username: String, password: String, promise: Promise) {
    scope.launch {
      try {
        val categories = try {
          fetchXtreamArray(serverUrl, username, password, "get_vod_categories")
        } catch (t: Throwable) {
          Log.w(TAG, "VOD categories unavailable: ${t.message}")
          JSONArray()
        }
        val categoryNames = mutableMapOf<String, String>()
        for (index in 0 until categories.length()) {
          val category = categories.optJSONObject(index) ?: continue
          categoryNames[category.optString("category_id")] = category.optString("category_name")
        }

        val items = fetchXtreamVodItems(serverUrl, username, password, categoryNames)

        Log.d(TAG, "Fetched ${items.size()} Xtream VOD items")
        promise.resolve(items)
      } catch (t: Throwable) {
        Log.e(TAG, "fetchXtreamVod failed: ${t.message}", t)
        promise.reject("VOD_FETCH_ERROR", t.message, t)
      }
    }
  }

  private fun fetchXtreamArray(
    serverUrl: String,
    username: String,
    password: String,
    action: String,
  ): JSONArray {
    val base = "${serverUrl.trimEnd('/')}/player_api.php".toHttpUrlOrNull()
      ?: throw IllegalArgumentException("Invalid Xtream server URL")
    val url = base.newBuilder()
      .addQueryParameter("username", username)
      .addQueryParameter("password", password)
      .addQueryParameter("action", action)
      .build()
    httpClient.newCall(Request.Builder().url(url).build()).execute().use { response ->
      if (!response.isSuccessful) throw IllegalStateException("$action failed with HTTP ${response.code}")
      return JSONArray(response.body?.string().orEmpty())
    }
  }

  private fun fetchXtreamVodItems(
    serverUrl: String,
    username: String,
    password: String,
    categoryNames: Map<String, String>,
  ): WritableArray {
    val url = buildXtreamActionUrl(serverUrl, username, password, "get_vod_streams")
    httpClient.newCall(Request.Builder().url(url).build()).execute().use { response ->
      if (!response.isSuccessful) throw IllegalStateException("get_vod_streams failed with HTTP ${response.code}")
      val body = response.body ?: throw IllegalStateException("get_vod_streams returned an empty response")
      val items = Arguments.createArray()
      JsonReader(InputStreamReader(body.byteStream(), Charsets.UTF_8)).use { reader ->
        reader.beginArray()
        var index = 0L
        while (reader.hasNext()) {
          var streamId: Long? = null
          var fallbackId: Long? = null
          var name = "Untitled"
          var poster = ""
          var categoryId = ""
          var extension = "mp4"
          var rating = ""
          var releaseDate = ""
          var duration = ""

          reader.beginObject()
          while (reader.hasNext()) {
            when (reader.nextName()) {
              "stream_id" -> streamId = reader.nextLongValue()
              "num" -> fallbackId = reader.nextLongValue()
              "name" -> name = reader.nextStringValue().ifEmpty { "Untitled" }
              "stream_icon" -> poster = reader.nextStringValue()
              "category_id" -> categoryId = reader.nextStringValue()
              "container_extension" -> extension = reader.nextStringValue()
                .removePrefix(".")
                .ifEmpty { "mp4" }
              "rating" -> rating = reader.nextStringValue()
              "rating_5based" -> if (rating.isEmpty()) rating = reader.nextStringValue() else reader.skipValue()
              "releaseDate", "release_date" -> if (releaseDate.isEmpty()) releaseDate = reader.nextStringValue() else reader.skipValue()
              "duration" -> duration = reader.nextStringValue()
              else -> reader.skipValue()
            }
          }
          reader.endObject()

          val id = streamId ?: fallbackId ?: index
          items.pushMap(Arguments.createMap().apply {
            putString("id", "xtream-vod-$id")
            putString("name", name)
            putString("url", buildVodUrl(serverUrl, username, password, id, extension))
            putOptionalString("poster", poster)
            putString("group", categoryNames[categoryId] ?: "Uncategorized")
            putOptionalString("rating", rating)
            putOptionalString("releaseDate", releaseDate)
            putOptionalString("duration", duration)
            putString("extension", extension)
          })
          index++
        }
        reader.endArray()
      }
      return items
    }
  }

  private fun buildXtreamActionUrl(
    serverUrl: String,
    username: String,
    password: String,
    action: String,
  ) = ("${serverUrl.trimEnd('/')}/player_api.php".toHttpUrlOrNull()
    ?: throw IllegalArgumentException("Invalid Xtream server URL"))
    .newBuilder()
    .addQueryParameter("username", username)
    .addQueryParameter("password", password)
    .addQueryParameter("action", action)
    .build()

  private fun JsonReader.nextStringValue(): String = when (peek()) {
    JsonToken.NULL -> { nextNull(); "" }
    JsonToken.STRING -> nextString()
    JsonToken.NUMBER -> nextString()
    JsonToken.BOOLEAN -> nextBoolean().toString()
    else -> { skipValue(); "" }
  }

  private fun JsonReader.nextLongValue(): Long? = nextStringValue().toLongOrNull()

  private fun buildVodUrl(
    serverUrl: String,
    username: String,
    password: String,
    streamId: Long,
    extension: String,
  ): String {
    val base = serverUrl.trimEnd('/').toHttpUrlOrNull()
      ?: throw IllegalArgumentException("Invalid Xtream server URL")
    return base.newBuilder()
      .addPathSegment("movie")
      .addPathSegment(username)
      .addPathSegment(password)
      .addPathSegment("$streamId.$extension")
      .build()
      .toString()
  }

  private fun WritableMap.putOptionalString(key: String, value: String) {
    if (value.isNotBlank() && value != "null") putString(key, value)
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
