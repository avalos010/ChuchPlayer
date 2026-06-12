package com.chuchplayer.epg

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp

class SideEpgViewManager(private val reactContext: ReactApplicationContext) :
    SimpleViewManager<SideEpgView>() {

    override fun getName() = "SideEpgView"

    override fun createViewInstance(context: ThemedReactContext) = SideEpgView(context)

    @ReactProp(name = "channelId")
    fun setChannelId(view: SideEpgView, value: String?) {
        view.setChannelId(value)
    }

    @ReactProp(name = "channelName")
    fun setChannelName(view: SideEpgView, value: String?) {
        view.setChannelName(value)
    }

    @ReactProp(name = "channelLogo")
    fun setChannelLogo(view: SideEpgView, value: String?) {
        view.setChannelLogo(value)
    }

    @ReactProp(name = "catchupAvailable", defaultBoolean = false)
    fun setCatchupAvailable(view: SideEpgView, value: Boolean) {
        view.setCatchupAvailable(value)
    }

    @ReactProp(name = "programs")
    fun setPrograms(view: SideEpgView, json: String?) {
        view.setPrograms(json ?: "[]")
    }

    @ReactProp(name = "nowMs", defaultDouble = 0.0)
    fun setNowMs(view: SideEpgView, value: Double) {
        if (value > 0.0) view.setNowMs(value)
    }

    @ReactProp(name = "clockFormat")
    fun setClockFormat(view: SideEpgView, value: String?) {
        view.setClockFormat(value)
    }

    @ReactProp(name = "accentColor")
    fun setAccentColor(view: SideEpgView, color: String?) {
        if (!color.isNullOrEmpty()) view.setAccentColor(color)
    }

    @ReactProp(name = "bgColor")
    fun setBgColor(view: SideEpgView, color: String?) {
        if (!color.isNullOrEmpty()) view.setBgColor(color)
    }
}
