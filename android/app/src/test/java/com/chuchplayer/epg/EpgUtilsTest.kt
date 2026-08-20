package com.chuchplayer.epg

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.ByteArrayInputStream
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale
import java.util.TimeZone

class EpgUtilsTest {
    @Test
    fun normalizeKeysBuildsStableLookupVariants() {
        val keys = normalizeKeys(" ESPN+ News_HD ")

        assertEquals("espn+ news_hd", keys[0])
        assertTrue(keys.contains("espnnewshd"))
        assertTrue(keys.contains("espn+news_hd"))
        assertTrue(keys.contains("espn+ newshd"))
        assertEquals(keys.distinct(), keys)
    }

    @Test
    fun parseChannelsJsonPrioritizesTvgIdThenIdThenName() {
        val channelsJson = """
            [
              {"id":"internal-espn", "name":"ESPN Plus", "tvgId":"ESPN.US"},
              {"id":"kids-1", "name":"Kids Planet"}
            ]
        """.trimIndent()

        val index = parseChannelsJson(channelsJson)

        assertEquals("internal-espn", index["espnus"]?.single()?.id)
        assertEquals("internal-espn", index["internalespn"]?.single()?.id)
        assertEquals("internal-espn", index["espnplus"]?.single()?.id)
        assertEquals("kids-1", index["kidsplanet"]?.single()?.id)
    }

    @Test
    fun resolveEpgUrlBuildsXmltvEndpointFromM3uCredentials() {
        val result = resolveEpgUrl(
            "https://example.com/get.php?username=user%40mail.com&password=pa%20ss&type=m3u_plus"
        )

        assertEquals(
            "https://example.com/xmltv.php?username=user%40mail.com&password=pa%20ss",
            result
        )
    }

    @Test
    fun parseChannelsJsonKeepsEveryStreamSharingATvgId() {
        val channelsJson = """
            [
              {"id":"fox-hd", "name":"Fox HD", "tvgId":"fox.us"},
              {"id":"fox-sd", "name":"Fox SD", "tvgId":"fox.us"}
            ]
        """.trimIndent()

        val matches = parseChannelsJson(channelsJson)["foxus"]

        assertEquals(listOf("fox-hd", "fox-sd"), matches?.map { it.id })
    }

    @Test
    fun programBuilderParsesXmltvTimezoneAndDefaultsMissingStopToOneHour() {
        val startUtc = utcMillis(2026, Calendar.MAY, 29, 10, 0, 0)
        val builder = ProgramBuilder(
            playlistId = "playlist-1",
            channelIndex = mapOf("espnus" to listOf(ChannelInfo("channel-1", "ESPN", "ESPN.US"))),
            epgChannelId = "ESPN.US",
            start = "20260529120000 +0200",
            stop = ""
        )

        val program = builder.build(startUtc - 1_000L, startUtc + 4_000_000L)

        assertNotNull(program)
        assertEquals("channel-1", program?.channelId)
        assertEquals("Untitled", program?.title)
        assertEquals(startUtc, program?.start)
        assertEquals(startUtc + 3_600_000L, program?.end)
    }

    @Test
    fun programBuilderRejectsUnknownChannelsAndInvalidDates() {
        val channelIndex = mapOf("espnus" to listOf(ChannelInfo("channel-1", "ESPN", "ESPN.US")))

        val unknownChannel = ProgramBuilder(
            playlistId = "playlist-1",
            channelIndex = channelIndex,
            epgChannelId = "missing",
            start = "20260529120000 +0000",
            stop = "20260529130000 +0000"
        )

        assertNull(unknownChannel.build(0L, Long.MAX_VALUE))
        assertEquals("no-channel", unknownChannel.rejectionReason)

        val invalidDate = ProgramBuilder(
            playlistId = "playlist-1",
            channelIndex = channelIndex,
            epgChannelId = "ESPN.US",
            start = "not-a-date",
            stop = "20260529130000 +0000"
        )

        assertNull(invalidDate.build(0L, Long.MAX_VALUE))
        assertEquals("invalid-date", invalidDate.rejectionReason)
    }

    @Test
    fun parseXmlStreamMatchesChannelsAndFiltersUnmatchedPrograms() {
        val now = System.currentTimeMillis()
        val start = formatXmltvDate(now - 10 * 60_000L)
        val stop = formatXmltvDate(now + 50 * 60_000L)
        val xml = """
            <?xml version="1.0" encoding="UTF-8"?>
            <tv>
              <programme channel="ESPN.US" start="$start" stop="$stop">
                <title>Live Match Center</title>
                <desc>Deterministic native unit test program.</desc>
              </programme>
              <programme channel="UNKNOWN" start="$start" stop="$stop">
                <title>Should Not Match</title>
              </programme>
            </tv>
        """.trimIndent()

        val channelIndex = parseChannelsJson(
            """[{"id":"channel-1", "name":"ESPN", "tvgId":"ESPN.US"}]"""
        )

        val programs = parseXmlStream(
            ByteArrayInputStream(xml.toByteArray(Charsets.UTF_8)),
            "playlist-1",
            channelIndex
        )

        assertEquals(1, programs.size)
        assertEquals("playlist-1", programs[0].playlistId)
        assertEquals("channel-1", programs[0].channelId)
        assertEquals("Live Match Center", programs[0].title)
        assertEquals("Deterministic native unit test program.", programs[0].description)
        assertEquals("ESPN.US", programs[0].epgChannelId)
    }

    @Test
    fun parseXmlStreamWritesProgramsForEveryStreamSharingATvgId() {
        val now = System.currentTimeMillis()
        val start = formatXmltvDate(now - 10 * 60_000L)
        val stop = formatXmltvDate(now + 50 * 60_000L)
        val xml = """
            <tv>
              <programme channel="FOX.US" start="$start" stop="$stop">
                <title>Local News</title>
              </programme>
            </tv>
        """.trimIndent()
        val channelIndex = parseChannelsJson(
            """[
                {"id":"fox-hd", "name":"Fox HD", "tvgId":"FOX.US"},
                {"id":"fox-sd", "name":"Fox SD", "tvgId":"FOX.US"}
            ]"""
        )

        val programs = parseXmlStream(
            ByteArrayInputStream(xml.toByteArray(Charsets.UTF_8)),
            "playlist-1",
            channelIndex
        )

        assertEquals(listOf("fox-hd", "fox-sd"), programs.map { it.channelId })
    }

    private fun utcMillis(
        year: Int,
        month: Int,
        day: Int,
        hour: Int,
        minute: Int,
        second: Int
    ): Long =
        Calendar.getInstance(TimeZone.getTimeZone("UTC")).apply {
            set(year, month, day, hour, minute, second)
            set(Calendar.MILLISECOND, 0)
        }.timeInMillis

    private fun formatXmltvDate(value: Long): String =
        SimpleDateFormat("yyyyMMddHHmmss Z", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }.format(value)
}
