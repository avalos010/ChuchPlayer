package com.chuchplayer.player

import android.content.Context
import android.util.Log
import android.widget.FrameLayout
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.exoplayer.DefaultLoadControl
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.events.RCTEventEmitter

// Self-contained player tile for multi-screen mode.
// Each instance owns its own ExoPlayer so streams are independent.
class MultiExoPlayerView(context: Context) : FrameLayout(context) {

    private val TAG = "MultiExoPlayerView"
    private var player: ExoPlayer? = null
    private val playerView: PlayerView = PlayerView(context).apply {
        useController = false
        resizeMode = AspectRatioFrameLayout.RESIZE_MODE_ZOOM
        layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
    }

    init {
        addView(playerView)
    }

    private fun getOrCreatePlayer(): ExoPlayer {
        player?.let { return it }

        val loadControl = DefaultLoadControl.Builder()
            .setBufferDurationsMs(1_000, 30_000, 500, 1_000)
            .build()

        val http = DefaultHttpDataSource.Factory()
            .setAllowCrossProtocolRedirects(true)
            .setConnectTimeoutMs(30_000)
            .setReadTimeoutMs(120_000)

        val p = ExoPlayer.Builder(context)
            .setLoadControl(loadControl)
            .setMediaSourceFactory(DefaultMediaSourceFactory(http))
            .build()
            .apply {
                addListener(object : Player.Listener {
                    override fun onPlaybackStateChanged(state: Int) {
                        val s = when (state) {
                            Player.STATE_IDLE -> "idle"
                            Player.STATE_BUFFERING -> "buffering"
                            Player.STATE_READY -> "ready"
                            Player.STATE_ENDED -> "ended"
                            else -> "unknown"
                        }
                        dispatchEvent("onStateChange", Arguments.createMap().apply {
                            putString("state", s)
                        })
                    }

                    override fun onPlayerError(error: PlaybackException) {
                        val rootCause = generateSequence(error as Throwable) { it.cause }.last()
                        val detail = "${error.errorCodeName}: ${rootCause.javaClass.simpleName}: ${rootCause.message}"
                        Log.e(TAG, "Player error: $detail", error)
                        dispatchEvent("onError", Arguments.createMap().apply {
                            putString("error", detail)
                        })
                    }
                })
            }

        playerView.player = p
        player = p
        return p
    }

    fun loadSource(url: String?) {
        if (url.isNullOrBlank()) return
        val p = getOrCreatePlayer()
        p.setMediaItem(MediaItem.Builder().setUri(url).build())
        p.prepare()
    }

    fun setPlaying(playing: Boolean) {
        val p = player ?: if (playing) getOrCreatePlayer() else return
        if (playing) p.play() else p.pause()
    }

    fun setVolume(volume: Float) {
        player?.volume = volume.coerceIn(0f, 1f)
    }

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        playerView.player = null
        player?.release()
        player = null
    }

    private fun dispatchEvent(eventName: String, params: com.facebook.react.bridge.WritableMap) {
        val ctx = context
        if (ctx is ThemedReactContext) {
            ctx.getJSModule(RCTEventEmitter::class.java)
                ?.receiveEvent(id, eventName, params)
        }
    }
}
