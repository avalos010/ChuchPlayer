package com.chuchplayer.epg

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
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
import org.json.JSONArray
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Collections
import java.util.Date
import java.util.Locale
import java.util.concurrent.Executors
import kotlin.math.max
import kotlin.math.min

class SideEpgView(context: Context) : View(context) {
    companion object {
        const val EVENT_CATCHUP_SELECT = "SIDE_EPG_CATCHUP_SELECT"
        const val EVENT_OPEN_GROUPS = "SIDE_EPG_OPEN_GROUPS"
    }

    data class Program(
        val id: String,
        val channelId: String,
        val title: String,
        val startMs: Long,
        val endMs: Long,
    )

    private val dp = context.resources.displayMetrics.density
    private val headerH = (46 * dp).toInt()
    private val rowH = (72 * dp).toInt()
    private val pad = (12 * dp).toInt()
    private val timeW = (54 * dp).toInt()
    private val logoSize = (34 * dp).toInt()
    private val mainHandler = Handler(Looper.getMainLooper())
    private val scroller = OverScroller(context)
    private val logoCache = object : LruCache<String, Bitmap>(8 * 1024 * 1024) {
        override fun sizeOf(key: String, value: Bitmap) = value.byteCount
    }
    private val logoExecutor = Executors.newSingleThreadExecutor()
    private val loadingLogos = Collections.synchronizedSet(mutableSetOf<String>())
    private val failedLogos = Collections.synchronizedSet(mutableSetOf<String>())

    private var channelId = ""
    private var channelName = ""
    private var channelLogo = ""
    private var catchupAvailable = false
    private var programs = emptyList<Program>()
    private var nowMs = System.currentTimeMillis()
    private var clockFormat = "24h"
    private var timeFormat = SimpleDateFormat("HH:mm", Locale.getDefault())
    private var focused = 0
    private var offsetY = 0f
    private var bg = Color.rgb(5, 8, 13)
    private var accent = Color.rgb(27, 144, 255)

    private val pBg = Paint().apply { color = bg }
    private val pHeader = Paint().apply { color = Color.rgb(10, 15, 24) }
    private val pSep = Paint().apply { color = Color.argb(60, 148, 163, 184); strokeWidth = dp }
    private val pRowCurrent = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(18, 35, 55) }
    private val pRowFocus = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(232, 242, 255) }
    private val pCatchup = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(10, 42, 54) }
    private val pAccent = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = accent }
    private val pMuted = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.argb(70, 5, 8, 13) }
    private val pLogo = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(17, 24, 39) }
    private val rect = RectF()

    private val tHeader = text(Color.rgb(219, 234, 254), 14f, true)
    private val tInitials = text(Color.rgb(159, 179, 200), 11f, true, center = true)
    private val tBadge = text(accent, 9f, true, center = true)
    private val tEmpty = text(Color.rgb(127, 150, 178), 11f, true, center = true)
    private val tTime = text(Color.rgb(127, 150, 178), 10.5f, true, center = true)
    private val tTimeNow = text(accent, 10.5f, true, center = true)
    private val tTimeFocus = text(Color.rgb(51, 65, 85), 10.5f, true, center = true)
    private val tTitle = text(Color.rgb(190, 210, 230), 13f, true)
    private val tTitleNow = text(Color.rgb(245, 248, 255), 13f, true)
    private val tTitleFocus = text(Color.rgb(6, 18, 37), 13f, true)
    private val tDur = text(Color.rgb(127, 150, 178), 10f, false)
    private val tDurFocus = text(Color.rgb(51, 65, 85), 10f, false)

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

    fun setChannelId(value: String?) {
        channelId = value ?: ""
    }

    fun setChannelName(value: String?) {
        channelName = value ?: ""
        invalidate()
    }

    fun setChannelLogo(value: String?) {
        channelLogo = value ?: ""
        invalidate()
    }

    fun setCatchupAvailable(value: Boolean) {
        catchupAvailable = value
        invalidate()
    }

    fun setPrograms(json: String) {
        programs = try {
            val arr = JSONArray(json)
            List(arr.length()) { i ->
                val o = arr.getJSONObject(i)
                Program(
                    id = o.optString("id"),
                    channelId = o.optString("channelId", channelId),
                    title = o.optString("title"),
                    startMs = o.optDouble("startMs", 0.0).toLong(),
                    endMs = o.optDouble("endMs", 0.0).toLong(),
                )
            }.filter { it.id.isNotBlank() && it.title.isNotBlank() && it.endMs > it.startMs }
        } catch (_: Exception) {
            emptyList()
        }
        focused = programs.indexOfFirst { isCurrent(it) }.takeIf { it >= 0 } ?: 0
        keepFocusedVisible(false)
        invalidate()
    }

    fun setNowMs(value: Double) {
        nowMs = value.toLong()
        invalidate()
    }

    fun setClockFormat(value: String?) {
        clockFormat = value ?: "24h"
        timeFormat = SimpleDateFormat(if (clockFormat == "12h") "h:mm a" else "HH:mm", Locale.getDefault())
        invalidate()
    }

    fun setAccentColor(hex: String) {
        try {
            val c = Color.parseColor(hex)
            accent = c
            pAccent.color = c
            tBadge.color = c
            tTimeNow.color = c
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

    override fun onDraw(canvas: Canvas) {
        canvas.drawColor(bg)
        drawHeader(canvas)
        if (programs.isEmpty()) {
            canvas.drawText("No guide data", width / 2f, headerH + (height - headerH) / 2f, tEmpty)
            return
        }

        val bodyH = height - headerH
        val first = max(0, (offsetY / rowH).toInt())
        val last = min(programs.lastIndex, ((offsetY + bodyH) / rowH).toInt() + 2)
        for (i in first..last) drawProgram(canvas, i, headerH + i * rowH - offsetY)
    }

    private fun drawHeader(canvas: Canvas) {
        canvas.drawRect(0f, 0f, width.toFloat(), headerH.toFloat(), pHeader)
        val logoLeft = pad.toFloat()
        val logoTop = (headerH - logoSize) / 2f
        rect.set(logoLeft, logoTop, logoLeft + logoSize, logoTop + logoSize)
        canvas.drawRoundRect(rect, 8f * dp, 8f * dp, pLogo)
        val bitmap = channelLogo.takeIf { it.isNotBlank() }?.let { logoCache.get(it) }
        if (bitmap != null) {
            canvas.drawBitmap(bitmap, null, rect, null)
        } else {
            queueLogo(channelLogo)
            val initials = channelName.take(2).uppercase().ifBlank { "TV" }
            canvas.drawText(initials, rect.centerX(), rect.centerY() - (tInitials.ascent() + tInitials.descent()) / 2f, tInitials)
        }

        val titleX = logoLeft + logoSize + 9f * dp
        drawEllipsis(canvas, channelName.ifBlank { "Guide" }, titleX, 29f * dp, width - titleX - pad - if (catchupAvailable) 70f * dp else 0f, tHeader)
        if (catchupAvailable) {
            rect.set(width - 70f * dp, 13f * dp, width - pad.toFloat(), 32f * dp)
            canvas.drawRoundRect(rect, 4f * dp, 4f * dp, pCatchup)
            canvas.drawText("CATCHUP", rect.centerX(), rect.centerY() - (tBadge.ascent() + tBadge.descent()) / 2f, tBadge)
        }
        canvas.drawLine(0f, headerH - dp, width.toFloat(), headerH - dp, pSep)
    }

    private fun drawProgram(canvas: Canvas, index: Int, top: Float) {
        val program = programs[index]
        val current = isCurrent(program)
        val past = program.endMs <= nowMs
        val canCatchup = past && catchupAvailable
        val focusedRow = index == focused && hasFocus()
        val bottom = top + rowH

        when {
            focusedRow -> {
                rect.set(6f * dp, top + 4f * dp, width - 6f * dp, bottom - 4f * dp)
                canvas.drawRoundRect(rect, 8f * dp, 8f * dp, pRowFocus)
            }
            current -> {
                rect.set(0f, top, width.toFloat(), bottom)
                canvas.drawRect(rect, pRowCurrent)
                canvas.drawRect(0f, top, 4f * dp, bottom, pAccent)
            }
        }

        val timePaint = when {
            focusedRow -> tTimeFocus
            current -> tTimeNow
            else -> tTime
        }
        val titlePaint = when {
            focusedRow -> tTitleFocus
            current -> tTitleNow
            else -> tTitle
        }
        val durPaint = if (focusedRow) tDurFocus else tDur

        val timeX = pad + timeW / 2f
        canvas.drawText(formatTime(program.startMs), timeX, top + 25f * dp, timePaint)
        if (canCatchup) {
            rect.set(pad.toFloat() + 12f * dp, top + 34f * dp, pad.toFloat() + timeW - 12f * dp, top + 49f * dp)
            canvas.drawRoundRect(rect, 4f * dp, 4f * dp, pCatchup)
            canvas.drawText("PLAY", rect.centerX(), rect.centerY() - (tBadge.ascent() + tBadge.descent()) / 2f, tBadge)
        } else if (current) {
            canvas.drawCircle(timeX, top + 42f * dp, 3.5f * dp, pAccent)
        }

        val textX = pad + timeW + 8f * dp
        drawEllipsis(canvas, program.title, textX, top + 29f * dp, width - textX - pad, titlePaint)
        drawEllipsis(canvas, "${formatTime(program.startMs)} - ${formatTime(program.endMs)}", textX, top + 49f * dp, width - textX - pad, durPaint)

        if (past && !canCatchup) {
            rect.set(0f, top, width.toFloat(), bottom)
            canvas.drawRect(rect, pMuted)
        }
        canvas.drawLine(pad.toFloat(), bottom - dp, width - pad.toFloat(), bottom - dp, pSep)
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
            KeyEvent.KEYCODE_DPAD_LEFT -> {
                fireOpenGroups()
                return true
            }
            KeyEvent.KEYCODE_DPAD_UP -> {
                moveFocus(-1)
                return true
            }
            KeyEvent.KEYCODE_DPAD_DOWN -> {
                moveFocus(1)
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
                if (idx in programs.indices) {
                    focused = idx
                    keepFocusedVisible(false)
                    selectFocused()
                    invalidate()
                }
                return true
            }
        }
        return true
    }

    override fun onFocusChanged(gainFocus: Boolean, direction: Int, previouslyFocusedRect: android.graphics.Rect?) {
        super.onFocusChanged(gainFocus, direction, previouslyFocusedRect)
        invalidate()
    }

    private fun moveFocus(delta: Int) {
        if (programs.isEmpty()) return
        focused = (focused + delta).coerceIn(0, programs.lastIndex)
        keepFocusedVisible(true)
        invalidate()
    }

    private fun selectFocused() {
        val program = programs.getOrNull(focused) ?: return
        if (program.endMs > nowMs || !catchupAvailable) return
        val event = Arguments.createMap().apply {
            putString("channelId", program.channelId.ifBlank { channelId })
            putDouble("startMs", program.startMs.toDouble())
            putDouble("endMs", program.endMs.toDouble())
            putString("programTitle", program.title)
        }
        (context as? ReactContext)
            ?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            ?.emit(EVENT_CATCHUP_SELECT, event)
    }

    private fun fireOpenGroups() {
        val event = Arguments.createMap().apply { putString("channelId", channelId) }
        (context as? ReactContext)
            ?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            ?.emit(EVENT_OPEN_GROUPS, event)
    }

    private fun queueLogo(url: String) {
        if (url.isBlank() || failedLogos.contains(url) || logoCache.get(url) != null || !loadingLogos.add(url)) return
        logoExecutor.execute {
            try {
                val connection = URL(url).openConnection().apply {
                    connectTimeout = 2500
                    readTimeout = 2500
                }
                val bitmap = connection.getInputStream().use { input ->
                    BitmapFactory.decodeStream(input)
                }
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

    private fun maxOffY() = max(0, programs.size * rowH - max(0, height - headerH))

    private fun isCurrent(program: Program) = program.startMs <= nowMs && program.endMs > nowMs

    private fun formatTime(ms: Long): String {
        return timeFormat.format(Date(ms))
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        mainHandler.post { invalidate() }
    }
}
