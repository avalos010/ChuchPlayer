package com.chuchplayer.epg

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Paint
import android.graphics.RectF
import android.os.Handler
import android.os.Looper
import android.util.LruCache
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.View
import android.widget.OverScroller
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.modules.core.DeviceEventManagerModule
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray
import java.util.Collections
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import kotlin.math.max
import kotlin.math.min

class ChannelListView(context: Context) : View(context) {
    companion object {
        const val EVENT_SELECT = "CHANNEL_LIST_SELECT"
        const val EVENT_FOCUS = "CHANNEL_LIST_FOCUS"
        const val EVENT_OPEN_GROUPS = "CHANNEL_LIST_OPEN_GROUPS"
        const val EVENT_TAB_SELECT = "CHANNEL_LIST_TAB_SELECT"
        const val EVENT_SEARCH = "CHANNEL_LIST_SEARCH"
    }

    data class Row(
        val id: String,
        val name: String,
        val logo: String,
        val number: String,
        val catchup: Boolean,
        val programTitle: String,
        val programStart: Long,
        val programEnd: Long,
    )

    private val dp = context.resources.displayMetrics.density
    private val rowH = (80 * dp).toInt()
    private val headerH = (54 * dp).toInt()
    private val searchH = (42 * dp).toInt()
    private val tabsH = (44 * dp).toInt()
    private val chromeH = headerH + searchH + tabsH
    private val logo = (44 * dp).toInt()
    private val pad = (10 * dp).toInt()
    private val numW = (38 * dp).toInt()
    private val mainHandler = Handler(Looper.getMainLooper())
    private val scroller = OverScroller(context)
    private val logoCache = object : LruCache<String, Bitmap>(24 * 1024 * 1024) {
        override fun sizeOf(key: String, value: Bitmap) = value.byteCount
    }
    private val logoExecutor = Executors.newFixedThreadPool(2)
    private val loadingLogos = Collections.synchronizedSet(mutableSetOf<String>())
    private val failedLogos = Collections.synchronizedSet(mutableSetOf<String>())
    private val http = OkHttpClient.Builder()
        .connectTimeout(3, TimeUnit.SECONDS)
        .readTimeout(3, TimeUnit.SECONDS)
        .followRedirects(true)
        .followSslRedirects(true)
        .build()

    private var rows = emptyList<Row>()
    private var currentId: String? = null
    private var focused = 0
    private var offsetY = 0f
    private var showNumbers = false
    private var title = "All Channels"
    private var activeTab = "all"
    private var searchQuery = ""
    private var accent = Color.rgb(27, 144, 255)
    private var bg = Color.rgb(5, 8, 13)

    // -1 = list mode; 0 = Groups button; 1 = Search; 2 = All tab; 3 = Fav tab; 4 = Recent tab
    private var chromeItem = -1

    private val pBg = Paint().apply { color = bg }
    private val pHeader = Paint().apply { color = Color.rgb(8, 12, 20) }
    private val pCard = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(14, 22, 34) }
    private val pCardActive = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(17, 31, 50) }
    private val pRow = Paint(Paint.ANTI_ALIAS_FLAG)
    private val pFocus = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(232, 242, 255) }
    private val pCurrent = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(17, 31, 50) }
    private val pLogo = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(17, 24, 39) }
    private val pBorder = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeWidth = dp; color = Color.argb(40, 148, 163, 184) }
    private val pAccent = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = accent }
    private val pProgress = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.argb(40, 148, 163, 184) }
    private val pChromeFocus = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE; strokeWidth = 2f * dp; color = Color.rgb(232, 242, 255)
    }
    private val tName = text(Color.rgb(219, 234, 254), 13.5f, true)
    private val tNameFocus = text(Color.rgb(6, 18, 37), 13.5f, true)
    private val tHeader = text(Color.rgb(238, 245, 255), 16f, true)
    private val tHeaderSub = text(Color.rgb(127, 150, 178), 11f, true)
    private val tButton = text(Color.rgb(190, 210, 230), 11f, true, center = true)
    private val tTabActive = text(accent, 11f, true, center = true)
    private val tSearch = text(Color.rgb(127, 150, 178), 12f, true)
    private val tMeta = text(Color.rgb(127, 150, 178), 10.5f, false)
    private val tMetaFocus = text(Color.rgb(51, 65, 85), 10.5f, false)
    private val tProgram = text(Color.rgb(160, 185, 210), 10.5f, false)
    private val tProgramFocus = text(Color.rgb(40, 60, 80), 10.5f, false)
    private val tTime = text(Color.rgb(100, 130, 160), 9.5f, false)
    private val tTimeFocus = text(Color.rgb(60, 80, 100), 9.5f, false)
    private val tInit = text(Color.rgb(159, 179, 200), 13f, true, center = true)
    private val tInitFocus = text(Color.rgb(6, 18, 37), 13f, true, center = true)
    private val rect = RectF()

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

    fun setRows(json: String) {
        val now = System.currentTimeMillis()
        rows = try {
            val arr = JSONArray(json)
            List(arr.length()) { i ->
                val o = arr.getJSONObject(i)
                Row(
                    id = o.optString("id"),
                    name = o.optString("name"),
                    logo = o.optString("logo"),
                    number = o.optString("number"),
                    catchup = o.optBoolean("catchupAvailable", false),
                    programTitle = o.optString("programTitle", ""),
                    programStart = o.optLong("programStart", 0L),
                    programEnd = o.optLong("programEnd", 0L),
                )
            }.filter { it.id.isNotBlank() }
        } catch (_: Exception) {
            emptyList()
        }
        focused = rows.indexOfFirst { it.id == currentId }.takeIf { it >= 0 } ?: 0
        chromeItem = -1
        keepFocusedVisible(false)
        invalidate()
        mainHandler.post { requestFocus() }
    }

    fun setCurrentChannelId(id: String?) {
        currentId = id
        val idx = rows.indexOfFirst { it.id == id }
        if (idx >= 0) {
            focused = idx
            keepFocusedVisible(false)
        }
        invalidate()
    }

    fun setFocusedChannelId(id: String?) {
        val idx = rows.indexOfFirst { it.id == id }
        if (idx >= 0) {
            focused = idx
            keepFocusedVisible(true)
            invalidate()
        }
    }

    fun setShowNumbers(value: Boolean) {
        showNumbers = value
        invalidate()
    }

    fun setTitle(value: String?) {
        title = value?.takeIf { it.isNotBlank() } ?: "All Channels"
        invalidate()
    }

    fun setActiveTab(value: String?) {
        activeTab = value ?: "all"
        invalidate()
    }

    fun setSearchQuery(value: String?) {
        searchQuery = value ?: ""
        invalidate()
    }

    fun setAccentColor(hex: String) {
        try {
            accent = Color.parseColor(hex)
            pAccent.color = accent
            tTabActive.color = accent
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

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        mainHandler.post { requestFocus() }
    }

    override fun onDraw(canvas: Canvas) {
        canvas.drawColor(bg)
        drawChrome(canvas)
        if (rows.isEmpty()) return

        val first = max(0, (offsetY / rowH).toInt())
        val listH = max(0, height - chromeH)
        val last = min(rows.lastIndex, ((offsetY + listH) / rowH).toInt() + 2)
        for (i in first..last) drawRow(canvas, i, chromeH + i * rowH - offsetY)
    }

    private fun drawChrome(canvas: Canvas) {
        canvas.drawRect(0f, 0f, width.toFloat(), chromeH.toFloat(), pHeader)

        // Groups button
        val groupW = 86f * dp
        drawEllipsis(canvas, title, pad.toFloat() + 6f * dp, 25f * dp, width - groupW - pad * 3f, tHeader)
        canvas.drawText("${rows.size} channels", pad.toFloat() + 6f * dp, 43f * dp, tHeaderSub)
        rect.set(width - groupW - pad.toFloat(), 11f * dp, width - pad.toFloat(), 43f * dp)
        canvas.drawRoundRect(rect, 7f * dp, 7f * dp, pCard)
        canvas.drawText("Groups", rect.centerX(), rect.centerY() - (tButton.ascent() + tButton.descent()) / 2f, tButton)
        if (chromeItem == 0) canvas.drawRoundRect(rect, 7f * dp, 7f * dp, pChromeFocus)

        // Search bar
        rect.set(pad.toFloat(), headerH + 5f * dp, width - pad.toFloat(), headerH + searchH - 5f * dp)
        canvas.drawRoundRect(rect, 8f * dp, 8f * dp, pCard)
        val query = searchQuery.ifBlank { "Search channels..." }
        canvas.drawText(query, rect.left + 14f * dp, rect.centerY() - (tSearch.ascent() + tSearch.descent()) / 2f, tSearch)
        if (chromeItem == 1) canvas.drawRoundRect(rect, 8f * dp, 8f * dp, pChromeFocus)

        // Tabs
        val tabTop = headerH + searchH + 6f * dp
        val tabBottom = chromeH - 7f * dp
        val gap = 5f * dp
        val tabW = (width - pad * 2f - gap * 2f) / 3f
        drawTab(canvas, "all", "All",    pad.toFloat(),              tabTop, tabW, tabBottom, chromeItem == 2)
        drawTab(canvas, "fav", "Fav",    pad + tabW + gap,           tabTop, tabW, tabBottom, chromeItem == 3)
        drawTab(canvas, "recent", "Recent", pad + (tabW + gap) * 2f, tabTop, tabW, tabBottom, chromeItem == 4)
    }

    private fun drawTab(canvas: Canvas, id: String, label: String, left: Float, top: Float, w: Float, bottom: Float, dpadFocused: Boolean) {
        rect.set(left, top, left + w, bottom)
        canvas.drawRoundRect(rect, 7f * dp, 7f * dp, if (activeTab == id) pCardActive else pCard)
        if (activeTab == id) {
            canvas.drawRoundRect(rect, 7f * dp, 7f * dp, pBorder)
        }
        val paint = if (activeTab == id) tTabActive else tButton
        canvas.drawText(label, rect.centerX(), rect.centerY() - (paint.ascent() + paint.descent()) / 2f, paint)
        if (dpadFocused) canvas.drawRoundRect(rect, 7f * dp, 7f * dp, pChromeFocus)
    }

    private fun drawRow(canvas: Canvas, index: Int, top: Float) {
        val row = rows[index]
        val isFocused = index == focused && chromeItem == -1
        val isCurrent = row.id == currentId
        val bottom = top + rowH
        val now = System.currentTimeMillis()

        rect.set(6f * dp, top + 3f * dp, width - 6f * dp, bottom - 3f * dp)
        when {
            isFocused -> canvas.drawRoundRect(rect, 8f * dp, 8f * dp, pFocus)
            isCurrent -> canvas.drawRoundRect(rect, 8f * dp, 8f * dp, pCurrent)
        }
        if (isFocused || isCurrent) {
            canvas.drawRoundRect(rect, 8f * dp, 8f * dp, pBorder)
            canvas.drawRect(rect.left, rect.top, rect.left + 4f * dp, rect.bottom, pAccent)
        }

        var x = pad.toFloat() + 6f * dp
        if (showNumbers) {
            canvas.drawText(row.number.ifBlank { (index + 1).toString() }, x + numW - 4f * dp, top + 42f * dp, if (isFocused) tMetaFocus else tMeta)
            x += numW
        }

        // Logo
        val logoTop = top + ((rowH - logo) / 2f)
        rect.set(x, logoTop, x + logo, logoTop + logo)
        canvas.drawRoundRect(rect, 8f * dp, 8f * dp, pLogo)
        val bitmap = row.logo.takeIf { it.isNotBlank() }?.let { logoCache.get(it) }
        if (bitmap != null) {
            canvas.drawBitmap(bitmap, null, rect, null)
        } else {
            queueLogo(row.logo)
            val init = row.name.take(2).uppercase()
            val initPaint = if (isFocused) tInitFocus else tInit
            canvas.drawText(init, rect.centerX(), rect.centerY() - (initPaint.ascent() + initPaint.descent()) / 2f, initPaint)
        }
        val textX = x + logo + 10f * dp

        // LIVE badge (drawn first so text maxW accounts for it)
        if (isCurrent) {
            pAccent.alpha = 255
            val badgeW = 36f * dp
            rect.set(width - badgeW - 8f * dp, top + 16f * dp, width - 8f * dp, top + 32f * dp)
            canvas.drawRoundRect(rect, 4f * dp, 4f * dp, pAccent)
            val live = text(Color.WHITE, 8f, true, center = true)
            canvas.drawText("LIVE", rect.centerX(), rect.centerY() - (live.ascent() + live.descent()) / 2f, live)
        }

        val badgeReserve = if (isCurrent) 48f * dp else 6f * dp
        val textMaxW = width - textX - badgeReserve

        // Channel name
        val namePaint = if (isFocused) tNameFocus else tName
        drawEllipsis(canvas, row.name, textX, top + 24f * dp, textMaxW, namePaint)

        // Program info
        val hasProgram = row.programTitle.isNotBlank() && row.programEnd > row.programStart
        if (hasProgram) {
            val progPaint = if (isFocused) tProgramFocus else tProgram
            drawEllipsis(canvas, row.programTitle, textX, top + 41f * dp, textMaxW, progPaint)

            // Progress bar (full track + filled portion)
            val barLeft = textX
            val barRight = width - badgeReserve - 6f * dp
            val barTop = top + 51f * dp
            val barBottom = barTop + 3f * dp
            rect.set(barLeft, barTop, barRight, barBottom)
            canvas.drawRoundRect(rect, 2f * dp, 2f * dp, pProgress)
            if (row.programEnd > row.programStart) {
                val elapsed = (now - row.programStart).coerceIn(0L, row.programEnd - row.programStart)
                val ratio = elapsed.toFloat() / (row.programEnd - row.programStart)
                val fillRight = barLeft + (barRight - barLeft) * ratio
                if (fillRight > barLeft) {
                    rect.set(barLeft, barTop, fillRight, barBottom)
                    pAccent.alpha = 200
                    canvas.drawRoundRect(rect, 2f * dp, 2f * dp, pAccent)
                    pAccent.alpha = 255
                }
            }

            // Time range
            val startFmt = formatTime(row.programStart)
            val endFmt = formatTime(row.programEnd)
            val timePaint = if (isFocused) tTimeFocus else tTime
            canvas.drawText("$startFmt–$endFmt", textX, top + 65f * dp, timePaint)
        } else {
            // Fallback: show catchup status in place of program info
            val metaPaint = if (isFocused) tMetaFocus else tMeta
            val meta = if (row.catchup) "Catchup available" else "Live TV"
            drawEllipsis(canvas, meta, textX, top + 41f * dp, textMaxW, metaPaint)
        }
    }

    private fun formatTime(epochMs: Long): String {
        if (epochMs == 0L) return ""
        val cal = java.util.Calendar.getInstance()
        cal.timeInMillis = epochMs
        val h = cal.get(java.util.Calendar.HOUR_OF_DAY)
        val m = cal.get(java.util.Calendar.MINUTE)
        return "%d:%02d".format(h, m)
    }

    private fun drawEllipsis(canvas: Canvas, value: String, x: Float, y: Float, maxW: Float, paint: Paint) {
        if (maxW <= 0) return
        if (paint.measureText(value) <= maxW) {
            canvas.drawText(value, x, y, paint)
            return
        }
        var text = value
        while (text.length > 1 && paint.measureText("$text…") > maxW) text = text.dropLast(1)
        canvas.drawText("$text…", x, y, paint)
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        when (keyCode) {
            KeyEvent.KEYCODE_DPAD_LEFT -> {
                if (chromeItem == -1) {
                    fire(EVENT_OPEN_GROUPS, rows.getOrNull(focused)?.id)
                } else if (chromeItem in 2..4) {
                    chromeItem = if (chromeItem == 2) 4 else chromeItem - 1
                    invalidate()
                }
                return true
            }
            KeyEvent.KEYCODE_DPAD_RIGHT -> {
                if (chromeItem in 2..4) {
                    chromeItem = if (chromeItem == 4) 2 else chromeItem + 1
                    invalidate()
                }
                return true
            }
            KeyEvent.KEYCODE_DPAD_UP -> {
                if (chromeItem == -1) {
                    if (focused > 0) {
                        focused--
                        keepFocusedVisible(true)
                        fire(EVENT_FOCUS, rows.getOrNull(focused)?.id)
                        invalidate()
                    } else {
                        // Enter chrome at the active tab
                        chromeItem = when (activeTab) {
                            "fav" -> 3
                            "recent" -> 4
                            else -> 2
                        }
                        invalidate()
                    }
                } else {
                    chromeItem = when (chromeItem) {
                        in 2..4 -> 1  // tabs → search
                        1 -> 0        // search → groups
                        else -> 0     // groups stays
                    }
                    invalidate()
                }
                return true
            }
            KeyEvent.KEYCODE_DPAD_DOWN -> {
                if (chromeItem == -1) {
                    if (focused < rows.lastIndex) {
                        focused++
                        keepFocusedVisible(true)
                        fire(EVENT_FOCUS, rows.getOrNull(focused)?.id)
                        invalidate()
                    }
                } else {
                    chromeItem = when (chromeItem) {
                        0 -> 1  // groups → search
                        1 -> when (activeTab) {  // search → active tab
                            "fav" -> 3; "recent" -> 4; else -> 2
                        }
                        else -> -1  // tabs → list
                    }
                    invalidate()
                }
                return true
            }
            KeyEvent.KEYCODE_DPAD_CENTER, KeyEvent.KEYCODE_ENTER -> {
                if (chromeItem == -1) {
                    rows.getOrNull(focused)?.let { fire(EVENT_SELECT, it.id) }
                } else {
                    when (chromeItem) {
                        0 -> fire(EVENT_OPEN_GROUPS, rows.getOrNull(focused)?.id)
                        1 -> fireRaw(EVENT_SEARCH, null)
                        in 2..4 -> {
                            val tabId = when (chromeItem) { 2 -> "all"; 3 -> "fav"; else -> "recent" }
                            fireRaw(EVENT_TAB_SELECT, Arguments.createMap().apply { putString("tabId", tabId) })
                        }
                    }
                }
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
                if (event.y < chromeH) return true
                val dy = if (event.historySize > 0) event.y - event.getHistoricalY(0) else 0f
                offsetY = (offsetY - dy).coerceIn(0f, maxOffY().toFloat())
                invalidate()
                return true
            }
            MotionEvent.ACTION_UP -> {
                if (event.y < chromeH) {
                    handleChromeTap(event.x, event.y)
                    return true
                }
                val idx = ((event.y - chromeH + offsetY) / rowH).toInt()
                if (idx in rows.indices) {
                    focused = idx
                    chromeItem = -1
                    fire(EVENT_FOCUS, rows[idx].id)
                    fire(EVENT_SELECT, rows[idx].id)
                    invalidate()
                }
                return true
            }
        }
        return true
    }

    private fun handleChromeTap(x: Float, y: Float) {
        val groupW = 86f * dp
        if (y < headerH && x >= width - groupW - pad.toFloat()) {
            fire(EVENT_OPEN_GROUPS, rows.getOrNull(focused)?.id)
            return
        }
        if (y >= headerH && y < headerH + searchH) {
            fireRaw(EVENT_SEARCH, null)
            return
        }
        if (y >= headerH + searchH) {
            val gap = 5f * dp
            val tabW = (width - pad * 2f - gap * 2f) / 3f
            val id = when {
                x < pad + tabW -> "all"
                x < pad + tabW * 2f + gap -> "fav"
                else -> "recent"
            }
            fireRaw(EVENT_TAB_SELECT, Arguments.createMap().apply { putString("tabId", id) })
        }
    }

    private fun keepFocusedVisible(animated: Boolean) {
        val top = focused * rowH
        val bottom = top + rowH
        val listH = max(0, height - chromeH)
        val next = when {
            top < offsetY -> top.toFloat()
            bottom > offsetY + listH -> (bottom - listH).toFloat()
            else -> offsetY
        }.coerceIn(0f, maxOffY().toFloat())
        offsetY = next
        if (animated) invalidate()
    }

    private fun maxOffY() = max(0, rows.size * rowH - max(0, height - chromeH))

    private fun queueLogo(url: String) {
        if (url.isBlank() || failedLogos.contains(url) || logoCache.get(url) != null || !loadingLogos.add(url)) return
        logoExecutor.execute {
            try {
                val bytes = http.newCall(Request.Builder().url(url).build())
                    .execute().use { it.body?.bytes() }
                val bitmap = bytes?.let { BitmapFactory.decodeByteArray(it, 0, it.size) }
                if (bitmap != null) {
                    logoCache.put(url, bitmap)
                    mainHandler.post { invalidate() }
                } else {
                    failedLogos.add(url)
                }
            } catch (_: Exception) {
                failedLogos.add(url)
            } finally {
                loadingLogos.remove(url)
            }
        }
    }

    private fun fire(event: String, channelId: String?) {
        if (channelId == null) return
        val map = Arguments.createMap().apply { putString("channelId", channelId) }
        fireRaw(event, map)
    }

    private fun fireRaw(event: String, map: com.facebook.react.bridge.WritableMap?) {
        (context as? ReactContext)
            ?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            ?.emit(event, map ?: Arguments.createMap())
    }
}
