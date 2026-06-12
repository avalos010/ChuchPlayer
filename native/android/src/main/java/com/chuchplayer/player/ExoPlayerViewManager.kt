package com.chuchplayer.player

import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext

class ExoPlayerViewManager : SimpleViewManager<PlayerView>() {

    override fun getName() = "ExoPlayerView"

    override fun createViewInstance(context: ThemedReactContext): PlayerView {
        return PlayerView(context).apply {
            useController = false
            resizeMode = AspectRatioFrameLayout.RESIZE_MODE_FIT
            ExoPlayerHolder.attachPlayer(this)
        }
    }

    override fun onDropViewInstance(view: PlayerView) {
        ExoPlayerHolder.pendingViews.remove(view)
        view.player = null
        super.onDropViewInstance(view)
    }
}
