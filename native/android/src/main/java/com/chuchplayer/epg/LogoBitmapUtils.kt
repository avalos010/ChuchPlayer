package com.chuchplayer.epg

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import kotlin.math.min

internal fun calculateLogoSampleSize(width: Int, height: Int, targetSize: Int): Int {
    var sampleSize = 1
    while (min(width / (sampleSize * 2), height / (sampleSize * 2)) >= targetSize) {
        sampleSize *= 2
    }
    return sampleSize
}

internal fun decodeLogoBitmap(bytes: ByteArray, targetSize: Int): Bitmap? {
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
    if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null

    return BitmapFactory.decodeByteArray(
        bytes,
        0,
        bytes.size,
        BitmapFactory.Options().apply {
            inSampleSize = calculateLogoSampleSize(bounds.outWidth, bounds.outHeight, targetSize)
        },
    )
}
