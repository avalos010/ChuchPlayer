package com.chuchplayer.epg

import android.content.Context
import android.graphics.*
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.GestureDetector
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.View
import android.widget.OverScroller
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.modules.core.DeviceEventManagerModule
import kotlinx.coroutines.*
import org.json.JSONArray
import java.text.SimpleDateFormat
import java.util.*
import kotlin.math.max
import kotlin.math.min

class EpgGridView(context: Context) : View(context) {

    companion object {
        private const val TAG = "EpgGridView"
        const val EVENT_CHANNEL_SELECT = "EPG_CHANNEL_SELECT"
        const val EVENT_PROGRAM_INFO   = "EPG_PROGRAM_INFO"
    }

    // ── Layout (dp → px) ────────────────────────────────────────────────────
    // Sized so exactly 8 rows fit on a 1080p TV (density ~2.0):
    //   (1080px - 88px header) / 124px row ≈ 8 rows
    private val dp = context.resources.displayMetrics.density
    private val CH_COL  = (110 * dp).toInt()   // narrow channel column
    private val SLOT_W  = (150 * dp).toInt()   // 1-hour width (300px at 2x)
    private val ROW_H   = (62  * dp).toInt()   // 8 rows on 1080p
    private val HDR_H   = (44  * dp).toInt()   // time header
    private val PAD     = (10  * dp).toInt()
    private val BLOCK_R = 6 * dp
    private val LOGO_R  = 18 * dp              // initials circle radius

    // ── Time window: now-1h … now+11h ────────────────────────────────────────
    private val WIN_BEFORE_H = 1
    private val WIN_TOTAL_H  = 13
    private var windowStartMs = System.currentTimeMillis() - WIN_BEFORE_H * 3_600_000L

    // ── State ─────────────────────────────────────────────────────────────────
    private var channels    = emptyList<EpgChannel>()
    private var programs    = emptyMap<String, List<EpgProgram>>()
    private var currentId: String? = null
    private var playlistId: String? = null
    private var focusedRow  = 0
    private var epgOffsetX  = 0f   // horizontal scroll (timeline)
    private var epgOffsetY  = 0f   // vertical scroll (channels)

    // ── Coroutine / main-thread ────────────────────────────────────────────────
    private val scope       = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val mainHandler = Handler(Looper.getMainLooper())

    // ── Gesture / fling ───────────────────────────────────────────────────────
    private val scroller = OverScroller(context)
    private val gesture  = GestureDetector(context, object : GestureDetector.SimpleOnGestureListener() {
        override fun onScroll(e1: MotionEvent?, e2: MotionEvent, dx: Float, dy: Float): Boolean {
            nudge(dx, dy); return true
        }
        override fun onFling(e1: MotionEvent?, e2: MotionEvent, vx: Float, vy: Float): Boolean {
            scroller.fling(epgOffsetX.toInt(), epgOffsetY.toInt(),
                -vx.toInt(), -vy.toInt(), 0, maxOffX(), 0, maxOffY())
            invalidate(); return true
        }
        override fun onSingleTapUp(e: MotionEvent): Boolean {
            val row = ((e.y - HDR_H + epgOffsetY) / ROW_H).toInt()
            if (row in channels.indices) { focusedRow = row; fireSelect(); invalidate() }
            return true
        }
        override fun onLongPress(e: MotionEvent) {
            val row = ((e.y - HDR_H + epgOffsetY) / ROW_H).toInt()
            if (row in channels.indices) {
                focusedRow = row
                fireProgramInfo(row, e.x)
                invalidate()
            }
        }
    }).also { it.setIsLongpressEnabled(true) }

    // ── Paints ────────────────────────────────────────────────────────────────
    private val pBg         = Paint().apply { color = 0xFF0E0E0E.toInt() }
    private val pHdr        = Paint().apply { color = 0xFF080808.toInt() }
    private val pChCol      = Paint().apply { color = 0xFF0A0A0A.toInt() }
    private val pSep        = Paint().apply { color = 0xFF1C1C1C.toInt(); strokeWidth = dp }
    private val pFocusRow   = Paint().apply { color = 0xFF1A1A1A.toInt() }
    private val pCurrentRow = Paint().apply { color = 0xFF111111.toInt() }
    private val pFocusBorder= Paint().apply { color = 0xFFFFFFFF.toInt() }
    private val pNowLine    = Paint().apply { color = 0xFFEF4444.toInt(); strokeWidth = 2.5f * dp }
    private val pNowDot     = Paint().apply { color = 0xFFEF4444.toInt() }
    private val pBlockNow   = Paint().apply { color = 0xFFF0F0F0.toInt() }
    private val pBlockPast  = Paint().apply { color = 0xFF161616.toInt() }
    private val pBlockFut   = Paint().apply { color = 0xFF181818.toInt() }
    private val pBlockBrd   = Paint().apply { color = 0xFF262626.toInt(); style = Paint.Style.STROKE; strokeWidth = dp }
    private val pCircle     = Paint().apply { color = 0xFF252525.toInt() }
    private val pCircleCur  = Paint().apply { color = 0xFF2A2A2A.toInt() }

    private val tTime   = buildTextPaint(0xFF606060.toInt(), 14f)
    private val tTimeNow= buildTextPaint(0xFFCCCCCC.toInt(), 14f, bold = true)
    private val tChName = buildTextPaint(0xFFD4D4D4.toInt(), 14f, bold = true)
    private val tChNow  = buildTextPaint(0xFF888888.toInt(), 12f)
    private val tInit   = buildTextPaint(0xFFFFFFFF.toInt(), 16f, bold = true, center = true)
    private val tBTNow  = buildTextPaint(0xFF111111.toInt(), 14f, bold = true)  // block title, now
    private val tBT     = buildTextPaint(0xFF606060.toInt(), 14f)               // block title, other
    private val tBTime  = buildTextPaint(0xFF3A3A3A.toInt(), 11f)
    private val tBTimeN = buildTextPaint(0xFF555555.toInt(), 11f)
    private val tNoData = buildTextPaint(0xFF3A3A3A.toInt(), 12f)

    private fun buildTextPaint(
        color: Int, spSize: Float, bold: Boolean = false, center: Boolean = false
    ) = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        this.color = color
        textSize = spSize * dp
        typeface = if (bold) Typeface.create(Typeface.DEFAULT, Typeface.BOLD) else Typeface.DEFAULT
        textAlign = if (center) Paint.Align.CENTER else Paint.Align.LEFT
    }

    private val blockRf = RectF()
    private val sdf = SimpleDateFormat("HH:mm", Locale.getDefault())

    init {
        isFocusable = true
        isFocusableInTouchMode = true
        setLayerType(LAYER_TYPE_HARDWARE, null)
    }

    // ── Public API (called by ViewManager) ────────────────────────────────────

    fun setAccentColor(hex: String) {
        try {
            val c = Color.parseColor(hex)
            pFocusBorder.color = c
            pBlockNow.color    = c
            tTimeNow.color     = c
            invalidate()
        } catch (_: Exception) {}
    }

    fun setBgColor(hex: String) {
        try {
            val c = Color.parseColor(hex)
            pBg.color    = c
            pHdr.color   = (Color.valueOf(c).let {
                Color.argb(1f, (it.red() * 0.85f), (it.green() * 0.85f), (it.blue() * 0.85f))
            })
            pChCol.color = c
            invalidate()
        } catch (_: Exception) {}
    }

    fun setPlaylistId(id: String) {
        playlistId = id
        maybeLoad()
    }

    fun setChannels(json: String) {
        val list = mutableListOf<EpgChannel>()
        try {
            val arr = JSONArray(json)
            for (i in 0 until arr.length()) {
                val o = arr.getJSONObject(i)
                list += EpgChannel(
                    id   = o.getString("id"),
                    name = o.optString("name", ""),
                    logo = o.optString("logo", "").takeIf { it.isNotBlank() }
                )
            }
        } catch (e: Exception) { Log.e(TAG, "parse channels", e) }
        channels = list
        // scroll so focused row stays in view
        val idx = channels.indexOfFirst { it.id == currentId }.coerceAtLeast(0)
        focusedRow = idx
        ensureVisible(idx)
        maybeLoad()
        invalidate()
    }

    fun setCurrentChannelId(id: String?) {
        currentId = id
        val idx = channels.indexOfFirst { it.id == id }
        if (idx >= 0) { focusedRow = idx; ensureVisible(idx) }
        invalidate()
    }

    // ── Realm load ────────────────────────────────────────────────────────────

    private fun maybeLoad() {
        val pid = playlistId ?: return
        if (channels.isEmpty()) return
        val ids = channels.map { it.id }
        scope.launch {
            try {
                val realm = openRealm()
                val now   = System.currentTimeMillis()
                val lower = Date(now - HOURS_BEFORE * 3_600_000L)
                val upper = Date(now + HOURS_AFTER * 3_600_000L)
                val result = mutableMapOf<String, List<EpgProgram>>()
                try {
                    for (cid in ids) {
                        val rows = realm.where(ProgramRealm::class.java)
                            .equalTo("playlistId", pid)
                            .equalTo("channelId", cid)
                            .greaterThan("end", lower)
                            .lessThan("start", upper)
                            .findAll()
                        result[cid] = rows.map { p ->
                            EpgProgram(p.id, p.title, p.description ?: "", p.start.time, p.end.time)
                        }
                    }
                } finally { realm.close() }
                mainHandler.post { programs = result; invalidate() }
            } catch (e: Exception) { Log.e(TAG, "realm load", e) }
        }
    }

    // ── Draw ─────────────────────────────────────────────────────────────────

    override fun onDraw(canvas: Canvas) {
        val vw = width.toFloat()
        val vh = height.toFloat()
        val now = System.currentTimeMillis()

        canvas.drawRect(0f, 0f, vw, vh, pBg)

        // Rows (clipped below header)
        canvas.save()
        canvas.clipRect(0f, HDR_H.toFloat(), vw, vh)
        for (i in channels.indices) {
            val ry = HDR_H + i * ROW_H - epgOffsetY
            if (ry + ROW_H < HDR_H || ry > vh) continue
            drawRow(canvas, i, ry, now, vw)
        }
        // Current-time line (inside rows area)
        val nowX = nowLineX(now)
        if (nowX in CH_COL.toFloat()..vw) {
            canvas.drawLine(nowX, HDR_H.toFloat(), nowX, vh, pNowLine)
        }
        canvas.restore()

        // Fixed left column bg (covers row content that scrolled under it)
        canvas.drawRect(0f, HDR_H.toFloat(), CH_COL.toFloat(), vh, pChCol)

        // Header bg
        canvas.drawRect(0f, 0f, vw, HDR_H.toFloat(), pHdr)

        // Time labels
        drawHeader(canvas, now, vw)

        // Separator column edge
        canvas.drawLine(CH_COL.toFloat(), 0f, CH_COL.toFloat(), vh, pSep)

        // Dot at top of now-line
        val nowX2 = nowLineX(now)
        if (nowX2 in CH_COL.toFloat()..vw) {
            canvas.drawCircle(nowX2, HDR_H.toFloat(), 5 * dp, pNowDot)
        }

        // Re-draw channel cells on top (so program blocks don't bleed into left col)
        canvas.save()
        canvas.clipRect(0f, HDR_H.toFloat(), CH_COL.toFloat(), vh)
        for (i in channels.indices) {
            val ry = HDR_H + i * ROW_H - epgOffsetY
            if (ry + ROW_H < HDR_H || ry > vh) continue
            drawChannelCell(canvas, i, ry, now)
        }
        canvas.restore()
    }

    private fun nowLineX(now: Long) =
        CH_COL + (now - windowStartMs) / 3_600_000f * SLOT_W - epgOffsetX

    private fun drawHeader(canvas: Canvas, now: Long, vw: Float) {
        val hourMs = 3_600_000L
        val firstHour = (windowStartMs / hourMs) * hourMs  // align to hour boundary
        var ms = firstHour - hourMs
        while (true) {
            val x = CH_COL + (ms - windowStartMs) / 3_600_000f * SLOT_W - epgOffsetX
            if (x > vw + SLOT_W) break
            ms += hourMs
            if (x < CH_COL - SLOT_W) continue
            val label = sdf.format(Date(ms - hourMs))
            val isNow = (ms - hourMs <= now && now < ms)
            canvas.drawText(label, x + PAD, HDR_H / 2f + tTime.textSize / 3,
                if (isNow) tTimeNow else tTime)
            canvas.drawLine(x, 0f, x, HDR_H.toFloat(), pSep)
        }
        // "CHANNELS" label in top-left corner
        val chLabel = buildTextPaint(0xFF444444.toInt(), 18f, bold = true)
        canvas.drawText("CHANNELS", PAD.toFloat(), HDR_H / 2f + chLabel.textSize / 3, chLabel)
    }

    private fun drawRow(canvas: Canvas, idx: Int, ry: Float, now: Long, vw: Float) {
        val ch        = channels[idx]
        val isFocused = idx == focusedRow && hasFocus()
        val isCurrent = ch.id == currentId

        val bg = when { isFocused -> pFocusRow; isCurrent -> pCurrentRow; else -> pBg }
        canvas.drawRect(0f, ry, vw, ry + ROW_H, bg)

        if (isFocused) {
            canvas.drawRect(0f, ry, 4 * dp, ry + ROW_H, pFocusBorder)
        }
        canvas.drawLine(0f, ry + ROW_H - dp, vw, ry + ROW_H - dp, pSep)

        // Program timeline (clipped to right of channel column)
        canvas.save()
        canvas.clipRect(CH_COL.toFloat(), ry, vw, ry + ROW_H)
        drawProgramBlocks(canvas, ch, ry, now, isFocused, vw)
        canvas.restore()
    }

    private fun drawChannelCell(canvas: Canvas, idx: Int, ry: Float, now: Long) {
        val ch        = channels[idx]
        val isFocused = idx == focusedRow && hasFocus()
        val isCurrent = ch.id == currentId

        val cBg = if (isCurrent) pCircleCur else pCircle
        val cx  = PAD + LOGO_R
        val cy  = ry + ROW_H / 2f
        canvas.drawCircle(cx, cy, LOGO_R, cBg)

        val initials = ch.name.take(2).uppercase()
        canvas.drawText(initials, cx, cy + tInit.textSize * 0.38f, tInit)

        val nx = PAD + LOGO_R * 2 + PAD * 0.7f
        val nw = CH_COL - nx - PAD
        val ny = ry + ROW_H / 2f - tChName.textSize * 0.3f
        drawEllipsis(canvas, ch.name, nx, ny, nw, if (isFocused) buildTextPaint(0xFFFFFFFF.toInt(), 24f, bold=true) else tChName)

        val nowProg = programs[ch.id]?.find { it.startMs <= now && it.endMs > now }
        if (nowProg != null) {
            drawEllipsis(canvas, nowProg.title, nx, ny + tChName.textSize + 5 * dp, nw, tChNow)
        }
    }

    private fun drawProgramBlocks(
        canvas: Canvas, ch: EpgChannel, ry: Float, now: Long, isFocused: Boolean, vw: Float
    ) {
        val progs = programs[ch.id]
        if (progs.isNullOrEmpty()) {
            canvas.drawText("No guide data",
                CH_COL.toFloat() + PAD,
                ry + ROW_H / 2f + tNoData.textSize / 3, tNoData)
            return
        }
        for (prog in progs) {
            val bx1 = CH_COL + (prog.startMs - windowStartMs) / 3_600_000f * SLOT_W - epgOffsetX
            val bx2 = CH_COL + (prog.endMs   - windowStartMs) / 3_600_000f * SLOT_W - epgOffsetX
            if (bx2 < CH_COL || bx1 > vw) continue

            val isNow = prog.startMs <= now && prog.endMs > now
            val bp = when { isNow -> pBlockNow; prog.endMs < now -> pBlockPast; else -> pBlockFut }

            blockRf.set(
                max(bx1, CH_COL.toFloat()) + 2 * dp,
                ry + 4 * dp,
                bx2 - 2 * dp,
                ry + ROW_H - 4 * dp
            )
            if (blockRf.width() < 4 * dp) continue

            canvas.drawRoundRect(blockRf, BLOCK_R, BLOCK_R, bp)
            canvas.drawRoundRect(blockRf, BLOCK_R, BLOCK_R, pBlockBrd)

            val tx = blockRf.left + PAD * 0.8f
            val bw = blockRf.width() - PAD * 1.6f
            val titleP = if (isNow) tBTNow else tBT
            val timeP  = if (isNow) tBTimeN else tBTime
            val ty1 = blockRf.top + titleP.textSize + 2 * dp
            drawEllipsis(canvas, prog.title, tx, ty1, bw, titleP)

            val timeStr = "${sdf.format(Date(prog.startMs))}–${sdf.format(Date(prog.endMs))}"
            val ty2 = ty1 + timeP.textSize + 1 * dp
            if (ty2 < blockRf.bottom) {
                drawEllipsis(canvas, timeStr, tx, ty2, bw, timeP)
            }
        }
    }

    private fun drawEllipsis(canvas: Canvas, text: String, x: Float, y: Float, maxW: Float, p: Paint) {
        if (maxW <= 0 || text.isEmpty()) return
        if (p.measureText(text) <= maxW) { canvas.drawText(text, x, y, p); return }
        val ellW = p.measureText("…")
        var n = text.length
        while (n > 0 && p.measureText(text, 0, n) + ellW > maxW) n--
        canvas.drawText(text.substring(0, n) + "…", x, y, p)
    }

    // ── Scroll helpers ────────────────────────────────────────────────────────

    private fun nudge(dx: Float, dy: Float) {
        epgOffsetX = (epgOffsetX + dx).coerceIn(0f, maxOffX().toFloat())
        epgOffsetY = (epgOffsetY + dy).coerceIn(0f, maxOffY().toFloat())
        invalidate()
    }

    private fun maxOffX() = max(0, CH_COL + WIN_TOTAL_H * SLOT_W - width)
    private fun maxOffY() = max(0, channels.size * ROW_H - (height - HDR_H))

    private fun ensureVisible(idx: Int) {
        val top = idx * ROW_H
        val bot = top + ROW_H
        val vTop = epgOffsetY.toInt()
        val vBot = vTop + height - HDR_H
        when {
            top < vTop -> epgOffsetY = top.toFloat()
            bot > vBot -> epgOffsetY = (bot - (height - HDR_H)).toFloat().coerceAtLeast(0f)
        }
    }

    override fun computeScroll() {
        if (scroller.computeScrollOffset()) {
            epgOffsetX = scroller.currX.toFloat().coerceIn(0f, maxOffX().toFloat())
            epgOffsetY = scroller.currY.toFloat().coerceIn(0f, maxOffY().toFloat())
            invalidate()
        }
    }

    // ── Touch ─────────────────────────────────────────────────────────────────

    override fun onTouchEvent(e: MotionEvent): Boolean =
        gesture.onTouchEvent(e) || super.onTouchEvent(e)

    // ── D-pad (TV remote) ─────────────────────────────────────────────────────

    override fun onKeyDown(code: Int, event: KeyEvent): Boolean {
        when (code) {
            KeyEvent.KEYCODE_DPAD_UP -> {
                if (focusedRow > 0) { focusedRow--; ensureVisible(focusedRow); invalidate() }
                return true
            }
            KeyEvent.KEYCODE_DPAD_DOWN -> {
                if (focusedRow < channels.lastIndex) { focusedRow++; ensureVisible(focusedRow); invalidate() }
                return true
            }
            KeyEvent.KEYCODE_DPAD_LEFT -> {
                epgOffsetX = (epgOffsetX - SLOT_W / 2f).coerceAtLeast(0f); invalidate(); return true
            }
            KeyEvent.KEYCODE_DPAD_RIGHT -> {
                epgOffsetX = (epgOffsetX + SLOT_W / 2f).coerceAtMost(maxOffX().toFloat()); invalidate(); return true
            }
            KeyEvent.KEYCODE_DPAD_CENTER, KeyEvent.KEYCODE_ENTER, KeyEvent.KEYCODE_NUMPAD_ENTER -> {
                fireSelect(); return true
            }
            KeyEvent.KEYCODE_INFO -> {
                fireProgramInfo(focusedRow, null); return true
            }
        }
        return super.onKeyDown(code, event)
    }

    private fun fireSelect() {
        val ch = channels.getOrNull(focusedRow) ?: return
        val rc = context as? ReactContext ?: return
        rc.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(EVENT_CHANNEL_SELECT, Arguments.createMap().apply {
                putString("channelId", ch.id)
                putString("channelName", ch.name)
            })
    }

    private fun fireProgramInfo(row: Int, touchX: Float?) {
        val ch = channels.getOrNull(row) ?: return
        val rc = context as? ReactContext ?: return
        val now = System.currentTimeMillis()

        val progOrNull: EpgProgram? = if (touchX != null) {
            val timeMs = windowStartMs + ((touchX - CH_COL + epgOffsetX) / SLOT_W * 3_600_000f).toLong()
            programs[ch.id]?.find { it.startMs <= timeMs && it.endMs > timeMs }
                ?: programs[ch.id]?.find { it.startMs <= now && it.endMs > now }
        } else {
            programs[ch.id]?.find { it.startMs <= now && it.endMs > now }
        }
        val prog = progOrNull ?: return

        rc.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(EVENT_PROGRAM_INFO, Arguments.createMap().apply {
                putString("channelId", ch.id)
                putString("channelName", ch.name)
                putString("programId", prog.id)
                putString("title", prog.title)
                putString("description", prog.desc)
                putDouble("startMs", prog.startMs.toDouble())
                putDouble("endMs", prog.endMs.toDouble())
                putBoolean("catchupAvailable", false)
            })
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        requestFocus()
        // Reset window start so "now" is always near the left edge
        windowStartMs = System.currentTimeMillis() - WIN_BEFORE_H * 3_600_000L
        // Scroll timeline so current time is visible
        val nowOff = (1 * SLOT_W).toFloat()
        epgOffsetX = nowOff.coerceIn(0f, maxOffX().toFloat())
        maybeLoad()
    }

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        scope.cancel()
    }

    // ── Data classes ──────────────────────────────────────────────────────────

    data class EpgChannel(val id: String, val name: String, val logo: String?)
    data class EpgProgram(val id: String, val title: String, val desc: String, val startMs: Long, val endMs: Long)
}
