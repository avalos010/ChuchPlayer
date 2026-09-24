package com.chuchplayer.epg

import org.junit.Assert.assertEquals
import org.junit.Test

class ChannelListLogoSizingTest {
    @Test
    fun keepsLogosAtOrBelowDisplaySizeAtOriginalResolution() {
        assertEquals(1, calculateLogoSampleSize(44, 44, 44))
        assertEquals(1, calculateLogoSampleSize(128, 64, 64))
    }

    @Test
    fun downsamplesLargeSquareLogosToDisplaySize() {
        assertEquals(8, calculateLogoSampleSize(512, 512, 64))
    }

    @Test
    fun keepsWideAndTallLogosSharpAlongTheirShortEdge() {
        assertEquals(4, calculateLogoSampleSize(1024, 256, 64))
        assertEquals(4, calculateLogoSampleSize(256, 1024, 64))
    }
}
