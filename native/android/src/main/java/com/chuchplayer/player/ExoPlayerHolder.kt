package com.chuchplayer.player

import android.os.Build
import android.view.Surface
import android.view.SurfaceView
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView

// Shared singleton so ExoPlayerModule and ExoPlayerViewManager reference the same player instance.
// Both are always accessed on the main thread, so no locking needed.
object ExoPlayerHolder {
    var player: ExoPlayer? = null
    val pendingViews = mutableListOf<PlayerView>()
    private val attachedViews = mutableListOf<PlayerView>()
    private var autoFrameRate = false
    private var videoFrameRate = 0f

    fun attachPlayer(view: PlayerView) {
        if (!attachedViews.contains(view)) attachedViews.add(view)
        val p = player
        if (p != null) {
            view.player = p
        } else {
            pendingViews.add(view)
        }
    }

    fun detachPlayer(view: PlayerView) {
        pendingViews.remove(view)
        attachedViews.remove(view)
    }

    fun setAutoFrameRate(enabled: Boolean) {
        autoFrameRate = enabled
        applyFrameRate(if (enabled) videoFrameRate else 0f)
    }

    fun updateVideoFrameRate(frameRate: Float) {
        if (frameRate !in 1f..240f || frameRate == videoFrameRate) return
        videoFrameRate = frameRate
        if (autoFrameRate) applyFrameRate(frameRate)
    }

    private fun applyFrameRate(frameRate: Float) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return
        attachedViews.forEach { view ->
            val surface = (view.videoSurfaceView as? SurfaceView)?.holder?.surface
            if (surface?.isValid != true) return@forEach
            try {
                surface.setFrameRate(
                    frameRate,
                    Surface.FRAME_RATE_COMPATIBILITY_FIXED_SOURCE,
                )
            } catch (_: IllegalStateException) {
            }
        }
    }

    fun onPlayerCreated(p: ExoPlayer) {
        player = p
        pendingViews.forEach { it.player = p }
        pendingViews.clear()
    }

    fun release() {
        pendingViews.clear()
        attachedViews.clear()
        videoFrameRate = 0f
        player?.release()
        player = null
    }
}
