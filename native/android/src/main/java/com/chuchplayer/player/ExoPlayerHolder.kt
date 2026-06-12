package com.chuchplayer.player

import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView

// Shared singleton so ExoPlayerModule and ExoPlayerViewManager reference the same player instance.
// Both are always accessed on the main thread, so no locking needed.
object ExoPlayerHolder {
    var player: ExoPlayer? = null
    val pendingViews = mutableListOf<PlayerView>()

    fun attachPlayer(view: PlayerView) {
        val p = player
        if (p != null) {
            view.player = p
        } else {
            pendingViews.add(view)
        }
    }

    fun onPlayerCreated(p: ExoPlayer) {
        player = p
        pendingViews.forEach { it.player = p }
        pendingViews.clear()
    }

    fun release() {
        pendingViews.clear()
        player?.release()
        player = null
    }
}
