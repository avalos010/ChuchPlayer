package com.chuchplayer.epg

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp

class ChannelListViewManager(private val reactContext: ReactApplicationContext) :
    SimpleViewManager<ChannelListView>() {

    override fun getName() = "ChannelListView"

    override fun createViewInstance(context: ThemedReactContext) = ChannelListView(context)

    @ReactProp(name = "channels")
    fun setChannels(view: ChannelListView, json: String?) {
        view.setRows(json ?: "[]")
    }

    @ReactProp(name = "currentChannelId")
    fun setCurrentChannelId(view: ChannelListView, id: String?) {
        view.setCurrentChannelId(id)
    }

    @ReactProp(name = "focusedChannelId")
    fun setFocusedChannelId(view: ChannelListView, id: String?) {
        view.setFocusedChannelId(id)
    }

    @ReactProp(name = "showNumbers", defaultBoolean = false)
    fun setShowNumbers(view: ChannelListView, value: Boolean) {
        view.setShowNumbers(value)
    }

    @ReactProp(name = "title")
    fun setTitle(view: ChannelListView, value: String?) {
        view.setTitle(value)
    }

    @ReactProp(name = "activeTab")
    fun setActiveTab(view: ChannelListView, value: String?) {
        view.setActiveTab(value)
    }

    @ReactProp(name = "searchQuery")
    fun setSearchQuery(view: ChannelListView, value: String?) {
        view.setSearchQuery(value)
    }

    @ReactProp(name = "accentColor")
    fun setAccentColor(view: ChannelListView, color: String?) {
        if (!color.isNullOrEmpty()) view.setAccentColor(color)
    }

    @ReactProp(name = "bgColor")
    fun setBgColor(view: ChannelListView, color: String?) {
        if (!color.isNullOrEmpty()) view.setBgColor(color)
    }

    @ReactProp(name = "focusTrigger", defaultInt = 0)
    fun setFocusTrigger(view: ChannelListView, value: Int) {
        if (value > 0) view.post { view.requestFocus() }
    }
}
