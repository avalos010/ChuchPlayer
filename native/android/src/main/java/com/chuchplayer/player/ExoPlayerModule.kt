package com.chuchplayer.player

import android.util.Log
import androidx.media3.common.*
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.exoplayer.DefaultLoadControl
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.exoplayer.source.MediaSource
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import kotlinx.coroutines.*

class ExoPlayerModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
  private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())

  companion object {
    private const val TAG = "ExoPlayerModule"
    private const val EVENT_STATE_CHANGED = "PLAYER_STATE_CHANGED"
    private const val EVENT_ERROR = "PLAYER_ERROR"
    private const val EVENT_PROGRESS = "PLAYER_PROGRESS"
  }

  override fun getName() = "ExoPlayerModule"

  private fun getOrCreatePlayer(): ExoPlayer {
    ExoPlayerHolder.player?.let { return it }

    val p = ExoPlayer.Builder(reactApplicationContext)
      .setLoadControl(createLoadControl())
      .setMediaSourceFactory(createMediaSourceFactory())
      .build()
      .apply { addListener(createPlayerListener()) }

    ExoPlayerHolder.onPlayerCreated(p)
    return p
  }

  // 1 s min buffer → fast start; 30 s max → reasonable ahead-buffer for live TV
  private fun createLoadControl(): DefaultLoadControl =
    DefaultLoadControl.Builder()
      .setBufferDurationsMs(1_000, 30_000, 500, 1_000)
      .build()

  private fun createMediaSourceFactory(): MediaSource.Factory {
    // No custom user-agent (some IPTV panels reject unknown UAs; system default matches
    // what expo-av sent). Cross-protocol redirects are required — panels bounce
    // http↔https, which DefaultHttpDataSource blocks by default but OkHttp allowed.
    val http = DefaultHttpDataSource.Factory()
      .setAllowCrossProtocolRedirects(true)
      .setConnectTimeoutMs(30_000)
      .setReadTimeoutMs(120_000)
    return DefaultMediaSourceFactory(http)
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
      // Walk the cause chain — PlaybackException.message is just "Source error";
      // the actionable detail (HTTP status, UnrecognizedInputFormat, etc.) is in the root cause
      val rootCause = generateSequence(error as Throwable) { it.cause }.last()
      val detail = "${error.errorCodeName}: ${rootCause.javaClass.simpleName}: ${rootCause.message}"
      Log.e(TAG, "Player error: $detail", error)
      sendEvent(EVENT_ERROR, Arguments.createMap().apply {
        putString("error", detail)
      })
    }

    override fun onIsPlayingChanged(isPlaying: Boolean) {
      val p = ExoPlayerHolder.player ?: return
      sendEvent(EVENT_PROGRESS, Arguments.createMap().apply {
        putDouble("positionMs", p.currentPosition.toDouble())
        putDouble("bufferedMs", p.bufferedPosition.toDouble())
        putBoolean("isPlaying", isPlaying)
      })
    }
  }

  @ReactMethod
  fun loadSource(url: String, promise: Promise) {
    scope.launch {
      try {
        Log.d(TAG, "loadSource: $url")
        val p = getOrCreatePlayer()
        p.setMediaItem(MediaItem.Builder().setUri(url).build())
        p.prepare()
        promise.resolve(true)
      } catch (e: Exception) {
        Log.e(TAG, "loadSource failed: ${e.message}", e)
        promise.reject("LOAD_ERROR", e.message)
      }
    }
  }

  @ReactMethod
  fun play(promise: Promise) {
    scope.launch {
      try {
        getOrCreatePlayer().play()
        promise.resolve(true)
      } catch (e: Exception) {
        promise.reject("PLAY_ERROR", e.message)
      }
    }
  }

  // ExoPlayer must only be touched from the main thread — @ReactMethod runs on the
  // native-modules thread, so every player call hops via scope (Dispatchers.Main)
  @ReactMethod
  fun pause(promise: Promise) {
    scope.launch {
      try {
        ExoPlayerHolder.player?.pause()
        promise.resolve(true)
      } catch (e: Exception) {
        promise.reject("PAUSE_ERROR", e.message)
      }
    }
  }

  @ReactMethod
  fun stop(promise: Promise) {
    scope.launch {
      try {
        ExoPlayerHolder.player?.stop()
        promise.resolve(true)
      } catch (e: Exception) {
        promise.reject("STOP_ERROR", e.message)
      }
    }
  }

  @ReactMethod
  fun seekTo(positionMs: Double, promise: Promise) {
    scope.launch {
      try {
        ExoPlayerHolder.player?.seekTo(positionMs.toLong())
        promise.resolve(true)
      } catch (e: Exception) {
        promise.reject("SEEK_ERROR", e.message)
      }
    }
  }

  @ReactMethod
  fun getPlaybackInfo(promise: Promise) {
    scope.launch {
      try {
        val p = ExoPlayerHolder.player
        if (p == null) {
          promise.resolve(Arguments.createMap().apply { putBoolean("isLoaded", false) })
          return@launch
        }
        promise.resolve(Arguments.createMap().apply {
          putBoolean("isLoaded", true)
          putBoolean("isPlaying", p.isPlaying)
          putBoolean("isBuffering", p.playbackState == Player.STATE_BUFFERING)
          putBoolean("didJustFinish", p.playbackState == Player.STATE_ENDED)
          putDouble("positionMillis", p.currentPosition.toDouble())
          putDouble("playableDurationMillis", p.bufferedPosition.toDouble())
          putDouble("durationMillis", if (p.duration == C.TIME_UNSET) 0.0 else p.duration.toDouble())
        })
      } catch (e: Exception) {
        promise.reject("STATUS_ERROR", e.message)
      }
    }
  }

  @ReactMethod
  fun setBufferConfig(minMs: Int, maxMs: Int, promise: Promise) {
    Log.d(TAG, "setBufferConfig: min=$minMs max=$maxMs (requires player rebuild)")
    promise.resolve(true)
  }

  @ReactMethod
  fun preloadSource(url: String, promise: Promise) {
    Log.d(TAG, "preloadSource: $url (stub)")
    promise.resolve(true)
  }

  private fun sendEvent(eventName: String, params: WritableMap) {
    reactApplicationContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit(eventName, params)
  }

  override fun onCatalystInstanceDestroy() {
    super.onCatalystInstanceDestroy()
    scope.cancel()
    // release() must run on the main thread; scope is already cancelled so post directly
    android.os.Handler(android.os.Looper.getMainLooper()).post {
      ExoPlayerHolder.release()
    }
  }
}
