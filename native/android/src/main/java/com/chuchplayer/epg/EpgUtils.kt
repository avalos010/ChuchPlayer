package com.chuchplayer.epg

import android.util.Log
import io.realm.Realm
import io.realm.RealmConfiguration
import org.json.JSONArray
import org.xmlpull.v1.XmlPullParser
import org.xmlpull.v1.XmlPullParserFactory
import java.io.InputStream
import java.util.*

private const val TAG = "EpgUtils"
const val HOURS_BEFORE = 12L
const val HOURS_AFTER = 36L
const val BATCH_SIZE = 2000

fun getRealmConfig(): RealmConfiguration =
    RealmConfiguration.Builder()
        .name("default.realm")
        .schemaVersion(1)
        .build()

fun openRealm(): Realm = Realm.getInstance(getRealmConfig())

/** Normalizes a channel ID/name into lookup keys for matching EPG entries. */
fun normalizeKeys(value: String): List<String> {
    val trimmed = value.trim()
    if (trimmed.isEmpty()) return emptyList()
    val lower = trimmed.lowercase()
    val alphaNum = lower.replace(Regex("[^a-z0-9]"), "")
    val noSpaces = lower.replace(" ", "")
    val noDashes = lower.replace("-", "")
    val noUnder = lower.replace("_", "")
    return listOf(lower, alphaNum, noSpaces, noDashes, noUnder).distinct().filter { it.isNotEmpty() }
}

fun parseChannelsJson(channelsJson: String): Map<String, ChannelInfo> {
    val index = mutableMapOf<String, ChannelInfo>()
    try {
        val arr = JSONArray(channelsJson)
        for (i in 0 until arr.length()) {
            val obj = arr.getJSONObject(i)
            val id = obj.getString("id")
            val name = obj.optString("name", "")
            val tvgId = obj.optString("tvgId", null)?.takeIf { it.isNotBlank() }

            val info = ChannelInfo(id, name, tvgId)

            // tvgId has highest priority
            tvgId?.let { normalizeKeys(it).forEach { k -> index[k] = info } }

            // id is second priority
            normalizeKeys(id).forEach { k -> index.putIfAbsent(k, info) }

            // name is lowest priority, only when no tvgId
            if (name.isNotEmpty() && tvgId == null) {
                normalizeKeys(name).forEach { k -> index.putIfAbsent(k, info) }
            }
        }
    } catch (e: Exception) {
        Log.e(TAG, "Failed to parse channels JSON", e)
    }
    return index
}

fun parseXmlStream(
    inputStream: InputStream,
    playlistId: String,
    channelIndex: Map<String, ChannelInfo>
): List<ProgramData> {
    val programs = mutableListOf<ProgramData>()
    val factory = XmlPullParserFactory.newInstance().apply { isNamespaceAware = false }
    val parser = factory.newPullParser()
    parser.setInput(inputStream, "UTF-8")

    val now = System.currentTimeMillis()
    val lowerBound = now - HOURS_BEFORE * 3_600_000L
    val upperBound = now + HOURS_AFTER * 3_600_000L

    var currentProgram: ProgramBuilder? = null
    val currentText = StringBuilder()
    var eventType = parser.eventType

    while (eventType != XmlPullParser.END_DOCUMENT) {
        when (eventType) {
            XmlPullParser.START_TAG -> {
                currentText.clear()
                if (parser.name == "programme") {
                    currentProgram = ProgramBuilder(
                        playlistId = playlistId,
                        channelIndex = channelIndex,
                        epgChannelId = parser.getAttributeValue(null, "channel") ?: "",
                        start = parser.getAttributeValue(null, "start") ?: "",
                        stop = parser.getAttributeValue(null, "stop") ?: ""
                    )
                }
            }
            XmlPullParser.TEXT -> currentText.append(parser.text)
            XmlPullParser.END_TAG -> {
                when (parser.name) {
                    "title" -> currentProgram?.title = currentText.toString().trim()
                    "desc"  -> currentProgram?.description = currentText.toString().trim()
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

fun writeProgramsToRealm(programs: List<ProgramData>): Int {
    if (programs.isEmpty()) return 0
    var total = 0
    val realm = openRealm()
    try {
        programs.chunked(BATCH_SIZE).forEach { batch ->
            realm.executeTransaction { r ->
                batch.forEach { prog ->
                    val pk = "${prog.playlistId}|${prog.channelId}|${prog.start}|${prog.end}|${prog.title}"
                    if (r.where(ProgramRealm::class.java).equalTo("id", pk).findFirst() == null) {
                        r.createObject(ProgramRealm::class.java, pk).apply {
                            playlistId   = prog.playlistId
                            channelId    = prog.channelId
                            title        = prog.title
                            description  = prog.description
                            start        = Date(prog.start)
                            end          = Date(prog.end)
                            epgChannelId = prog.epgChannelId
                            createdAt    = Date()
                        }
                        total++
                    }
                }
            }
        }
    } finally {
        realm.close()
    }
    return total
}

fun updatePlaylistMetadata(playlistId: String, datasetSignature: String) {
    val realm = openRealm()
    try {
        realm.executeTransaction { r ->
            val existing = r.where(MetadataRealm::class.java)
                .equalTo("playlistId", playlistId).findFirst()
            if (existing != null) {
                existing.lastUpdated = Date()
                existing.sourceSignature = datasetSignature
            } else {
                r.createObject(MetadataRealm::class.java, playlistId).apply {
                    lastUpdated     = Date()
                    sourceSignature = datasetSignature
                }
            }
        }
    } finally {
        realm.close()
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
    var epgChannelId: String,
    var start: String,
    var stop: String
) {
    var title: String = ""
    var description: String? = null

    fun build(lowerBound: Long, upperBound: Long): ProgramData? {
        val info = matchChannel(epgChannelId) ?: return null
        val startMs = parseXmltvDate(start) ?: return null
        val endMs   = parseXmltvDate(stop) ?: (startMs + 3_600_000L)
        if (endMs < lowerBound || startMs > upperBound) return null
        return ProgramData(
            playlistId   = playlistId,
            channelId    = info.id,
            title        = title.ifEmpty { "Untitled" },
            description  = description,
            start        = startMs,
            end          = endMs,
            epgChannelId = epgChannelId
        )
    }

    private fun matchChannel(id: String): ChannelInfo? {
        if (id.isEmpty()) return null
        return normalizeKeys(id).firstNotNullOfOrNull { channelIndex[it] }
    }

    private fun parseXmltvDate(dateStr: String): Long? {
        if (dateStr.isEmpty()) return null
        return try {
            val cleaned = dateStr.trim().replace(" ", "")
            val tzRegex = Regex("([+-]\\d{4}|Z)$")
            val tzMatch = tzRegex.find(cleaned)
            val dateOnly = if (tzMatch != null) cleaned.dropLast(tzMatch.value.length) else cleaned
            if (dateOnly.length < 14) return null

            val year   = dateOnly.substring(0, 4).toInt()
            val month  = dateOnly.substring(4, 6).toInt() - 1
            val day    = dateOnly.substring(6, 8).toInt()
            val hour   = dateOnly.substring(8, 10).toInt()
            val minute = dateOnly.substring(10, 12).toInt()
            val second = dateOnly.substring(12, 14).toInt()

            val tz = when {
                tzMatch == null -> TimeZone.getTimeZone("UTC")
                tzMatch.value == "Z" -> TimeZone.getTimeZone("UTC")
                else -> {
                    val s = tzMatch.value
                    val sign = if (s[0] == '+') 1 else -1
                    val h = s.substring(1, 3).toInt()
                    val m = s.substring(3, 5).toInt()
                    TimeZone.getTimeZone("GMT%s%02d:%02d".format(if (sign > 0) "+" else "-", h, m))
                }
            }

            Calendar.getInstance(tz).apply {
                set(year, month, day, hour, minute, second)
                set(Calendar.MILLISECOND, 0)
            }.timeInMillis
        } catch (e: Exception) {
            Log.w(TAG, "Failed to parse date: $dateStr", e)
            null
        }
    }
}
