package com.chuchplayer.epg

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp

class EpgGridViewManager(private val reactContext: ReactApplicationContext) :
    SimpleViewManager<EpgGridView>() {

    override fun getName() = "EpgGridView"

    override fun createViewInstance(context: ThemedReactContext) = EpgGridView(context)

    @ReactProp(name = "playlistId")
    fun setPlaylistId(view: EpgGridView, id: String?) {
        if (!id.isNullOrEmpty()) view.setPlaylistId(id)
    }

    @ReactProp(name = "channels")
    fun setChannels(view: EpgGridView, json: String?) {
        if (!json.isNullOrEmpty()) view.setChannels(json)
    }

    @ReactProp(name = "currentChannelId")
    fun setCurrentChannelId(view: EpgGridView, id: String?) {
        view.setCurrentChannelId(id)
    }

    @ReactProp(name = "accentColor")
    fun setAccentColor(view: EpgGridView, color: String?) {
        if (!color.isNullOrEmpty()) view.setAccentColor(color)
    }

    @ReactProp(name = "bgColor")
    fun setBgColor(view: EpgGridView, color: String?) {
        if (!color.isNullOrEmpty()) view.setBgColor(color)
    }
}
