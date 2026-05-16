package com.chuchplayer.player

import android.util.Log
import androidx.media3.common.*
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.exoplayer.source.MediaSource
import androidx.media3.exoplayer.source.hls.HlsMediaSource
import androidx.media3.exoplayer.upstream.DefaultHttpDataSource
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import kotlinx.coroutines.*
import kotlin.math.max

class ExoPlayerModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
  private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())
  private var player: ExoPlayer? = null

  companion object {
    private const val TAG = "ExoPlayerModule"
    private const val EVENT_STATE_CHANGED = "PLAYER_STATE_CHANGED"
    private const val EVENT_ERROR = "PLAYER_ERROR"
    private const val EVENT_PROGRESS = "PLAYER_PROGRESS"
  }

  override fun getName() = "ExoPlayerModule"

  // Initialize the player with tight buffer settings for fast channel switching
  private fun getOrCreatePlayer(): ExoPlayer {
    if (player == null) {
      player = ExoPlayer.Builder(reactApplicationContext)
        .setLoadControl(createLoadControl())
        .setMediaSourceFactory(createMediaSourceFactory())
        .build()
        .apply {
          addListener(createPlayerListener())
        }
    }
    return player!!
  }

  // TiviMate-style buffer config: 1s min, 30s max → fast start + reasonable buffering
  private fun createLoadControl(): androidx.media3.exoplayer.LoadControl {
    return androidx.media3.exoplayer.DefaultLoadControl.Builder()
      .setBufferDurationsMs(
        1_000,    // minBufferMs — start playing after just 1s buffered
        30_000,   // maxBufferMs — max 30s buffered
        500,      // bufferForPlaybackMs — resume playback after 500ms buffered
        1_000     // bufferForPlaybackAfterRebufferMs — re-resume after 1s
      )
      .build()
  }

  private fun createMediaSourceFactory(): MediaSource.Factory {
    val httpDataSourceFactory = DefaultHttpDataSource.Factory()
      .setUserAgent("chuchPlayer/1.0")
      .setConnectTimeoutMs(30_000)
      .setReadTimeoutMs(120_000)

    return DefaultMediaSourceFactory(reactApplicationContext, httpDataSourceFactory)
  }

  private fun createPlayerListener() = object : Player.Listener {
    override fun onPlaybackStateChanged(state: Int) {
      val stateStr = when (state) {
        Player.STATE_IDLE -> "idle"
        Player.STATE_BUFFERING -> "buffering"
        Player.STATE_READY -> "ready"
        Player.STATE_ENDED -> "ended"
        else -> "unknown"
      }
      sendEvent(EVENT_STATE_CHANGED, Arguments.createMap().apply {
        putString("state", stateStr)
        putInt("stateInt", state)
      })
    }

    override fun onPlayerError(error: PlaybackException) {
      Log.e(TAG, "Player error: ${error.message}", error)
      sendEvent(EVENT_ERROR, Arguments.createMap().apply {
        putString("error", error.message ?: "Unknown error")
      })
    }

    override fun onIsPlayingChanged(isPlaying: Boolean) {
      val p = player ?: return
      sendEvent(EVENT_PROGRESS, Arguments.createMap().apply {
        putDouble("positionMs", p.currentPosition.toDouble())
        putDouble("bufferedMs", p.bufferedPosition.toDouble())
        putBoolean("isPlaying", isPlaying)
      })
    }
  }

  @ReactMethod
  fun loadSource(url: String, promise: Promise) {
    try {
      scope.launch {
        val p = getOrCreatePlayer()
        val mediaItem = MediaItem.Builder()
          .setUri(url)
          .build()
        p.setMediaItem(mediaItem)
        p.prepare()
        promise.resolve(true)
      }
    } catch (e: Exception) {
      Log.e(TAG, "loadSource failed: ${e.message}", e)
      promise.reject("LOAD_ERROR", e.message)
    }
  }

  @ReactMethod
  fun play(promise: Promise) {
    try {
      val p = player ?: run {
        promise.reject("NOT_INITIALIZED", "Player not initialized")
        return
      }
      p.play()
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("PLAY_ERROR", e.message)
    }
  }

  @ReactMethod
  fun pause(promise: Promise) {
    try {
      val p = player ?: run {
        promise.reject("NOT_INITIALIZED", "Player not initialized")
        return
      }
      p.pause()
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("PAUSE_ERROR", e.message)
    }
  }

  @ReactMethod
  fun stop(promise: Promise) {
    try {
      val p = player ?: run {
        promise.reject("NOT_INITIALIZED", "Player not initialized")
        return
      }
      p.stop()
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("STOP_ERROR", e.message)
    }
  }

  @ReactMethod
  fun seekTo(positionMs: Double, promise: Promise) {
    try {
      val p = player ?: run {
        promise.reject("NOT_INITIALIZED", "Player not initialized")
        return
      }
      p.seekTo(positionMs.toLong())
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("SEEK_ERROR", e.message)
    }
  }

  @ReactMethod
  fun setBufferConfig(minMs: Int, maxMs: Int, promise: Promise) {
    try {
      // Can't change buffer config on running player, would need to rebuild
      // This is informational for now; re-creating player with new config would be destructive
      Log.d(TAG, "setBufferConfig: min=$minMs max=$maxMs (rebuild needed for effect)")
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("CONFIG_ERROR", e.message)
    }
  }

  @ReactMethod
  fun preloadSource(url: String, promise: Promise) {
    // Preloading: create a separate ExoPlayer instance in the background
    // For now, just resolve — full implementation would pool players
    try {
      scope.launch {
        Log.d(TAG, "Preloading: $url")
        promise.resolve(true)
      }
    } catch (e: Exception) {
      promise.reject("PRELOAD_ERROR", e.message)
    }
  }

  private fun sendEvent(eventName: String, params: WritableMap) {
    reactApplicationContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit(eventName, params)
  }

  override fun onCatalystInstanceDestroy() {
    super.onCatalystInstanceDestroy()
    player?.release()
    player = null
    scope.cancel()
  }
}
