package com.chuchplayer.epg

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp

class GroupsRailViewManager(private val reactContext: ReactApplicationContext) :
    SimpleViewManager<GroupsRailView>() {

    override fun getName() = "GroupsRailView"

    override fun createViewInstance(context: ThemedReactContext) = GroupsRailView(context)

    @ReactProp(name = "groups")
    fun setGroups(view: GroupsRailView, json: String?) {
        view.setGroups(json ?: "[]")
    }

    @ReactProp(name = "playlists")
    fun setPlaylists(view: GroupsRailView, json: String?) {
        view.setPlaylists(json ?: "[]")
    }

    @ReactProp(name = "accentColor")
    fun setAccentColor(view: GroupsRailView, color: String?) {
        if (!color.isNullOrEmpty()) view.setAccentColor(color)
    }

    @ReactProp(name = "bgColor")
    fun setBgColor(view: GroupsRailView, color: String?) {
        if (!color.isNullOrEmpty()) view.setBgColor(color)
    }
}
