package com.chuchplayer.player

import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp

class MultiExoPlayerViewManager : SimpleViewManager<MultiExoPlayerView>() {

    override fun getName() = "MultiExoPlayerView"

    override fun createViewInstance(context: ThemedReactContext) = MultiExoPlayerView(context)

    @ReactProp(name = "source")
    fun setSource(view: MultiExoPlayerView, source: String?) {
        view.loadSource(source)
    }

    @ReactProp(name = "playing")
    fun setPlaying(view: MultiExoPlayerView, playing: Boolean) {
        view.setPlaying(playing)
    }

    @ReactProp(name = "volume", defaultFloat = 1f)
    fun setVolume(view: MultiExoPlayerView, volume: Float) {
        view.setVolume(volume)
    }

    override fun getExportedCustomDirectEventTypeConstants(): Map<String, Any> = mapOf(
        "onStateChange" to mapOf("registrationName" to "onStateChange"),
        "onError" to mapOf("registrationName" to "onError"),
    )
}
