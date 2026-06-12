package com.chuchplayer.epg

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.os.Handler
import android.os.Looper
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.View
import android.widget.OverScroller
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.modules.core.DeviceEventManagerModule
import org.json.JSONArray
import kotlin.math.max
import kotlin.math.min

class GroupsRailView(context: Context) : View(context) {
    companion object {
        const val EVENT_GROUP_SELECT = "GROUPS_RAIL_GROUP_SELECT"
        const val EVENT_PLAYLIST_SELECT = "GROUPS_RAIL_PLAYLIST_SELECT"
        const val EVENT_CLOSE = "GROUPS_RAIL_CLOSE"
    }

    data class Item(
        val id: String,
        val type: String,
        val name: String,
        val group: String?,
        val count: Int,
        val active: Boolean,
        val sourceType: String,
    )

    private val dp = context.resources.displayMetrics.density
    private val headerH = (70 * dp).toInt()
    private val rowH = (48 * dp).toInt()
    private val sectionH = (34 * dp).toInt()
    private val pad = (12 * dp).toInt()
    private val mainHandler = Handler(Looper.getMainLooper())
    private val scroller = OverScroller(context)

    private var groups = emptyList<Item>()
    private var playlists = emptyList<Item>()
    private var rows = emptyList<Item>()
    private var focused = 0
    private var offsetY = 0f
    private var bg = Color.rgb(7, 11, 18)
    private var accent = Color.rgb(27, 144, 255)

    private val pBg = Paint().apply { color = bg }
    private val pHeader = Paint().apply { color = Color.rgb(9, 15, 24) }
    private val pCard = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(14, 22, 34) }
    private val pActive = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(18, 35, 55) }
    private val pFocus = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(232, 242, 255) }
    private val pBorder = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeWidth = dp; color = Color.argb(55, 148, 163, 184) }
    private val pAccent = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = accent }
    private val rect = RectF()

    private val tTitle = text(Color.rgb(238, 245, 255), 16f, true)
    private val tSub = text(Color.rgb(127, 150, 178), 11f, true)
    private val tSection = text(Color.rgb(127, 150, 178), 9f, true)
    private val tName = text(Color.rgb(215, 230, 245), 13f, true)
    private val tNameFocus = text(Color.rgb(6, 18, 37), 13f, true)
    private val tCount = text(Color.rgb(127, 150, 178), 10f, true, center = true)
    private val tCountFocus = text(Color.rgb(51, 65, 85), 10f, true, center = true)

    init {
        isFocusable = true
        isFocusableInTouchMode = true
        setLayerType(LAYER_TYPE_HARDWARE, null)
    }

    private fun text(color: Int, sp: Float, bold: Boolean, center: Boolean = false) =
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            this.color = color
            textSize = sp * dp
            typeface = if (bold) android.graphics.Typeface.DEFAULT_BOLD else android.graphics.Typeface.DEFAULT
            textAlign = if (center) Paint.Align.CENTER else Paint.Align.LEFT
        }

    fun setGroups(json: String) {
        groups = parseItems(json)
        rebuildRows()
    }

    fun setPlaylists(json: String) {
        playlists = parseItems(json)
        rebuildRows()
    }

    fun setAccentColor(hex: String) {
        try {
            accent = Color.parseColor(hex)
            pAccent.color = accent
            invalidate()
        } catch (_: Exception) {}
    }

    fun setBgColor(hex: String) {
        try {
            bg = Color.parseColor(hex)
            pBg.color = bg
            invalidate()
        } catch (_: Exception) {}
    }

    private fun parseItems(json: String): List<Item> {
        return try {
            val arr = JSONArray(json)
            List(arr.length()) { i ->
                val o = arr.getJSONObject(i)
                Item(
                    id = o.optString("id"),
                    type = o.optString("type", "group"),
                    name = o.optString("name"),
                    group = if (o.isNull("group")) null else o.optString("group"),
                    count = o.optInt("count", 0),
                    active = o.optBoolean("active", false),
                    sourceType = o.optString("sourceType"),
                )
            }.filter { it.id.isNotBlank() && it.name.isNotBlank() }
        } catch (_: Exception) {
            emptyList()
        }
    }

    private fun rebuildRows() {
        rows = buildList {
            add(Item("__groups_header__", "section", "Groups", null, 0, false, ""))
            addAll(groups)
            if (playlists.isNotEmpty()) {
                add(Item("__playlists_header__", "section", "Playlists", null, 0, false, ""))
                addAll(playlists)
            }
        }
        focused = rows.indexOfFirst { it.active }.takeIf { it >= 0 } ?: rows.indexOfFirst { it.type != "section" }.coerceAtLeast(0)
        keepFocusedVisible(false)
        invalidate()
        mainHandler.post { requestFocus() }
    }

    override fun onDraw(canvas: Canvas) {
        canvas.drawColor(bg)
        drawHeader(canvas)
        val first = max(0, (offsetY / rowH).toInt())
        val last = min(rows.lastIndex, ((offsetY + height - headerH) / rowH).toInt() + 4)
        for (i in first..last) {
            val top = headerH + i * rowH - offsetY
            drawItem(canvas, rows[i], i, top)
        }
    }

    private fun drawHeader(canvas: Canvas) {
        canvas.drawRect(0f, 0f, width.toFloat(), headerH.toFloat(), pHeader)
        canvas.drawText("Groups & Playlists", pad.toFloat(), 29f * dp, tTitle)
        val active = groups.firstOrNull { it.active }?.name ?: "All Channels"
        drawEllipsis(canvas, active, pad.toFloat(), 49f * dp, width - pad * 2f, tSub)
        canvas.drawRect(0f, headerH - dp, width.toFloat(), headerH.toFloat(), pBorder)
    }

    private fun drawItem(canvas: Canvas, item: Item, index: Int, top: Float) {
        if (item.type == "section") {
            canvas.drawText(item.name.uppercase(), pad.toFloat(), top + 23f * dp, tSection)
            return
        }

        val isFocused = index == focused && hasFocus()
        rect.set(6f * dp, top + 3f * dp, width - 6f * dp, top + rowH - 3f * dp)
        when {
            isFocused -> canvas.drawRoundRect(rect, 7f * dp, 7f * dp, pFocus)
            item.active -> canvas.drawRoundRect(rect, 7f * dp, 7f * dp, pActive)
            else -> canvas.drawRoundRect(rect, 7f * dp, 7f * dp, pCard)
        }
        if (isFocused || item.active) {
            canvas.drawRoundRect(rect, 7f * dp, 7f * dp, pBorder)
            canvas.drawRect(rect.left, rect.top, rect.left + 3f * dp, rect.bottom, pAccent)
        }

        val namePaint = if (isFocused) tNameFocus else tName
        val countPaint = if (isFocused) tCountFocus else tCount
        val count = if (item.type == "playlist") item.sourceType.uppercase() else item.count.toString()
        val countW = max(36f * dp, countPaint.measureText(count) + 14f * dp)
        drawEllipsis(canvas, item.name, rect.left + 12f * dp, top + 31f * dp, rect.width() - countW - 24f * dp, namePaint)
        canvas.drawText(count, rect.right - countW / 2f - 8f * dp, top + 31f * dp, countPaint)
    }

    private fun drawEllipsis(canvas: Canvas, value: String, x: Float, y: Float, maxW: Float, paint: Paint) {
        if (maxW <= 0f) return
        if (paint.measureText(value) <= maxW) {
            canvas.drawText(value, x, y, paint)
            return
        }
        var text = value
        while (text.length > 1 && paint.measureText("$text...") > maxW) text = text.dropLast(1)
        canvas.drawText("$text...", x, y, paint)
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        when (keyCode) {
            KeyEvent.KEYCODE_DPAD_UP -> {
                moveFocus(-1)
                return true
            }
            KeyEvent.KEYCODE_DPAD_DOWN -> {
                moveFocus(1)
                return true
            }
            KeyEvent.KEYCODE_DPAD_RIGHT, KeyEvent.KEYCODE_BACK -> {
                fireClose()
                return true
            }
            KeyEvent.KEYCODE_DPAD_CENTER, KeyEvent.KEYCODE_ENTER -> {
                selectFocused()
                return true
            }
        }
        return super.onKeyDown(keyCode, event)
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                parent?.requestDisallowInterceptTouchEvent(true)
                scroller.forceFinished(true)
                requestFocus()
                return true
            }
            MotionEvent.ACTION_MOVE -> {
                val dy = if (event.historySize > 0) event.y - event.getHistoricalY(0) else 0f
                offsetY = (offsetY - dy).coerceIn(0f, maxOffY().toFloat())
                invalidate()
                return true
            }
            MotionEvent.ACTION_UP -> {
                val idx = ((event.y - headerH + offsetY) / rowH).toInt()
                if (idx in rows.indices && rows[idx].type != "section") {
                    focused = idx
                    selectFocused()
                    invalidate()
                }
                return true
            }
        }
        return true
    }

    private fun moveFocus(delta: Int) {
        if (rows.isEmpty()) return
        var next = focused
        do {
            next = (next + delta).coerceIn(0, rows.lastIndex)
            if (rows[next].type != "section" || next == focused) break
        } while (next in rows.indices)
        focused = next
        keepFocusedVisible(true)
        invalidate()
    }

    private fun selectFocused() {
        val item = rows.getOrNull(focused) ?: return
        if (item.type == "group") {
            val map = Arguments.createMap()
            if (item.group == null) map.putNull("group") else map.putString("group", item.group)
            emit(EVENT_GROUP_SELECT, map)
            return
        }
        if (item.type == "playlist") {
            emit(EVENT_PLAYLIST_SELECT, Arguments.createMap().apply { putString("playlistId", item.id) })
        }
    }

    private fun fireClose() {
        emit(EVENT_CLOSE, Arguments.createMap())
    }

    private fun keepFocusedVisible(animated: Boolean) {
        val bodyH = max(0, height - headerH)
        val top = focused * rowH
        val bottom = top + rowH
        offsetY = when {
            top < offsetY -> top.toFloat()
            bottom > offsetY + bodyH -> (bottom - bodyH).toFloat()
            else -> offsetY
        }.coerceIn(0f, maxOffY().toFloat())
        if (animated) invalidate()
    }

    private fun maxOffY() = max(0, rows.size * rowH - max(0, height - headerH))

    private fun emit(event: String, map: com.facebook.react.bridge.WritableMap) {
        (context as? ReactContext)
            ?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            ?.emit(event, map)
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        mainHandler.post { requestFocus() }
    }
}
