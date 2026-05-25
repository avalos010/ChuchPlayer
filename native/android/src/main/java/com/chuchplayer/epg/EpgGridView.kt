package com.chuchplayer.epg

import android.content.Context
import android.graphics.*
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.util.LruCache
import android.view.GestureDetector
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.View
import android.widget.OverScroller
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.modules.core.DeviceEventManagerModule
import kotlinx.coroutines.*
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray
import java.text.SimpleDateFormat
import java.util.*
import java.util.concurrent.TimeUnit
import kotlin.math.max
import kotlin.math.min

class EpgGridView(context: Context) : View(context) {

    companion object {
        private const val TAG = "EpgGridView"
        const val EVENT_CHANNEL_SELECT = "EPG_CHANNEL_SELECT"
        const val EVENT_PROGRAM_INFO   = "EPG_PROGRAM_INFO"
        const val EVENT_CHANNEL_FOCUS  = "EPG_CHANNEL_FOCUS"
    }

    private val dp = context.resources.displayMetrics.density

    // ── Layout ────────────────────────────────────────────────────────────────
    private val CH_NUM  = (38  * dp).toInt()   // channel number column
    private val CH_LOGO = (54  * dp).toInt()   // logo circle column
    private val CH_NAME = (168 * dp).toInt()   // name column
    private val PAD     = (10  * dp).toInt()
    private val CH_COL  = CH_NUM + CH_LOGO + CH_NAME + PAD  // total left column
    private val SLOT_W  = (130 * dp).toInt()   // px per hour
    private val ROW_H   = (50  * dp).toInt()   // channel row height
    private val HDR_H   = (42  * dp).toInt()   // time header height
    private val BLOCK_R = 2f * dp
    private val LOGO_R  = 17f * dp

    // ── Time window: now−1h … now+11h ────────────────────────────────────────
    private val WIN_BEFORE_H = 1
    private val WIN_TOTAL_H  = 12
    private var windowStartMs = System.currentTimeMillis() - WIN_BEFORE_H * 3_600_000L

    // ── State ─────────────────────────────────────────────────────────────────
    private var channels    = emptyList<EpgChannel>()
    private var programs    = emptyMap<String, List<EpgProgram>>()
    private var currentId: String? = null
    private var playlistId: String? = null
    private var focusedRow  = 0
    private var epgOffsetX  = 0f
    private var epgOffsetY  = 0f

    private val scope       = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val mainHandler = Handler(Looper.getMainLooper())

    // ── Logo image cache ──────────────────────────────────────────────────────
    private val logoCache = LruCache<String, Bitmap>(60)
    private val logoLoading = java.util.Collections.synchronizedSet(mutableSetOf<String>())
    private val http = OkHttpClient.Builder()
        .connectTimeout(8, TimeUnit.SECONDS)
        .readTimeout(8, TimeUnit.SECONDS)
        .build()
    private val logoPaint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
    private val logoClipPath = Path()

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
            if (row in channels.indices) { focusedRow = row; fireProgramInfo(row, e.x); invalidate() }
        }
    }).also { it.setIsLongpressEnabled(true) }

    // ── Paints ────────────────────────────────────────────────────────────────
    private val pBg          = Paint().apply { color = 0xFF0D1521.toInt() }
    private val pHdr         = Paint().apply { color = 0xFF090F18.toInt() }
    private val pChCol       = Paint().apply { color = 0xFF0D1521.toInt() }
    private val pSep         = Paint().apply { color = 0xFF1E2E42.toInt(); strokeWidth = dp }
    private val pHalfSep     = Paint().apply { color = 0xFF141E2D.toInt(); strokeWidth = dp * 0.5f }
    // Focused row: strong highlight so user can always see where they are
    private val pFocusRow    = Paint().apply { color = 0xFF1A3D6B.toInt() }
    private val pCurrentRow  = Paint().apply { color = 0xFF162840.toInt() }
    private val pFocusBorder   = Paint().apply { color = 0xFF1B90FF.toInt() }
    private val pCurrentBorder = Paint().apply { color = 0x991B90FF.toInt() } // 60% accent
    private val pNowLine     = Paint().apply { color = 0xFF1B90FF.toInt(); strokeWidth = 2.5f * dp }
    private val pNowDot      = Paint().apply { color = 0xFF1B90FF.toInt() }
    private val pBlockNow    = Paint().apply { color = 0xFF1A3E6A.toInt() }
    private val pBlockPast   = Paint().apply { color = 0xFF0B1420.toInt() }
    private val pBlockFut    = Paint().apply { color = 0xFF111B2A.toInt() }
    private val pBlockBrd    = Paint().apply { color = 0xFF223348.toInt(); style = Paint.Style.STROKE; strokeWidth = dp * 0.75f }
    private val pCircle      = Paint().apply { color = 0xFF18293C.toInt() }
    private val pCircleCur   = Paint().apply { color = 0xFF1D3C62.toInt() }
    private val pProgress    = Paint().apply { color = 0x26FFFFFF; style = Paint.Style.FILL }
    private val pPlayPath    = Paint().apply { color = 0xFF1B90FF.toInt(); style = Paint.Style.FILL; isAntiAlias = true }

    // Text paints — higher contrast for readability
    private val tDate      = buildText(0xFF1B90FF.toInt(), 11.5f, bold = true)
    private val tTime      = buildText(0xFF607898.toInt(), 10.5f)
    private val tTimeNow   = buildText(0xFF1B90FF.toInt(), 10.5f, bold = true)
    private val tChNum     = buildText(0xFF5080A0.toInt(), 13f, center = true)
    private val tChNumFoc  = buildText(0xFF1B90FF.toInt(), 13f, bold = true, center = true)
    private val tChName    = buildText(0xFFADBECC.toInt(), 12.5f, bold = true)
    private val tChNameFoc = buildText(0xFFF0F6FF.toInt(), 13f, bold = true)
    private val tChNow     = buildText(0xFF5888AA.toInt(), 10.5f)
    private val tInit      = buildText(0xFF7898B8.toInt(), 14f, bold = true, center = true)
    private val tBTNow     = buildText(0xFFE8F0FA.toInt(), 13f, bold = true)
    private val tBT        = buildText(0xFF6A8BA8.toInt(), 12f)
    private val tBTime     = buildText(0xFF4A6478.toInt(), 10f)
    private val tBTimeN    = buildText(0xFF7AAACE.toInt(), 10f)
    private val tNoData    = buildText(0xFF304050.toInt(), 11f)
    private val pCatchupBg = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFF1B3D5A.toInt() }
    private val tCatchup   = buildText(0xFF5AAAD0.toInt(), 8.5f, bold = true, center = true)

    private fun buildText(
        color: Int, spSize: Float, bold: Boolean = false, center: Boolean = false
    ) = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        this.color = color
        textSize  = spSize * dp
        typeface  = if (bold) Typeface.create(Typeface.DEFAULT, Typeface.BOLD) else Typeface.DEFAULT
        textAlign = if (center) Paint.Align.CENTER else Paint.Align.LEFT
    }

    private val blockRf   = RectF()
    private val sdfTime   = SimpleDateFormat("h:mm a", Locale.getDefault())
    private val sdfDate   = SimpleDateFormat("EEE, MMM d  h:mm a", Locale.getDefault())
    private val playPath  = Path()

    init {
        isFocusable = true
        isFocusableInTouchMode = true
        setLayerType(LAYER_TYPE_HARDWARE, null)
    }

    // ── Public API (called by ViewManager) ────────────────────────────────────

    fun setAccentColor(hex: String) {
        try {
            val c = Color.parseColor(hex)
            pFocusBorder.color   = c
            pCurrentBorder.color = Color.argb(0x80, Color.red(c), Color.green(c), Color.blue(c))
            pNowLine.color     = c
            pNowDot.color      = c
            pPlayPath.color    = c
            tDate.color        = c
            tTimeNow.color     = c
            tChNumFoc.color    = c
            // Catchup badge uses a darkened accent bg and lighter accent text
            pCatchupBg.color = Color.argb(0xFF,
                (Color.red(c)   * 0.25f).toInt(),
                (Color.green(c) * 0.25f).toInt(),
                (Color.blue(c)  * 0.35f).toInt())
            tCatchup.color = Color.argb(0xFF,
                (Color.red(c)   * 0.6f + 100 * 0.4f).toInt().coerceIn(0,255),
                (Color.green(c) * 0.6f + 150 * 0.4f).toInt().coerceIn(0,255),
                (Color.blue(c)  * 0.6f + 180 * 0.4f).toInt().coerceIn(0,255))
            // Tint block-now with accent
            pBlockNow.color = Color.argb(0xFF,
                (Color.red(c)   * 0.18f + 15  * 0.82f).toInt(),
                (Color.green(c) * 0.10f + 25  * 0.90f).toInt(),
                (Color.blue(c)  * 0.30f + 35  * 0.70f).toInt())
            invalidate()
        } catch (_: Exception) {}
    }

    fun setBgColor(hex: String) {
        try {
            val c = Color.parseColor(hex)
            val r = Color.red(c).toFloat()
            val g = Color.green(c).toFloat()
            val b = Color.blue(c).toFloat()

            // Helper: mix bg toward white by fraction t
            fun lift(t: Float) = Color.argb(0xFF,
                (r + (255 - r) * t).toInt().coerceIn(0, 255),
                (g + (255 - g) * t).toInt().coerceIn(0, 255),
                (b + (255 - b) * t).toInt().coerceIn(0, 255))

            // Helper: darken bg by fraction t
            fun darken(t: Float) = Color.argb(0xFF,
                (r * (1 - t)).toInt().coerceIn(0, 255),
                (g * (1 - t)).toInt().coerceIn(0, 255),
                (b * (1 - t)).toInt().coerceIn(0, 255))

            pBg.color         = c
            pChCol.color      = c
            pHdr.color        = darken(0.20f)
            pSep.color        = lift(0.18f)
            pHalfSep.color    = lift(0.09f)
            pFocusRow.color   = lift(0.45f)   // strong — must stand out clearly
            pCurrentRow.color = lift(0.22f)   // clearly above unfocused bg
            pBlockPast.color  = darken(0.15f)
            pBlockFut.color   = lift(0.12f)
            pCircle.color     = lift(0.15f)
            pCircleCur.color  = lift(0.30f)
            // pBlockNow is derived from accent in setAccentColor — skip here

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
                    id               = o.getString("id"),
                    name             = o.optString("name", ""),
                    logo             = o.optString("logo", "").takeIf { it.isNotBlank() },
                    number           = i + 1,
                    catchupAvailable = o.optBoolean("catchupAvailable", false)
                )
            }
        } catch (e: Exception) { Log.e(TAG, "parse channels", e) }
        channels = list
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

    fun maybeLoad() {
        val pid = playlistId ?: return
        if (channels.isEmpty()) return
        val ids = channels.map { it.id }
        scope.launch {
            try {
                val realm = openRealm()
                val now   = System.currentTimeMillis()
                val lower = Date(now - HOURS_BEFORE * 3_600_000L)
                val upper = Date(now + HOURS_AFTER  * 3_600_000L)
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
        val vw  = width.toFloat()
        val vh  = height.toFloat()
        val now = System.currentTimeMillis()

        canvas.drawRect(0f, 0f, vw, vh, pBg)

        // ── Rows (clipped below header) ──────────────────────────────────────
        canvas.save()
        canvas.clipRect(0f, HDR_H.toFloat(), vw, vh)
        for (i in channels.indices) {
            val ry = HDR_H + i * ROW_H - epgOffsetY
            if (ry + ROW_H < HDR_H || ry > vh) continue
            drawRow(canvas, i, ry, now, vw)
        }
        // Current-time vertical line
        val nowX = nowLineX(now)
        if (nowX in CH_COL.toFloat()..vw) {
            canvas.drawLine(nowX, HDR_H.toFloat(), nowX, vh, pNowLine)
        }
        canvas.restore()

        // Fixed left column overlay
        canvas.drawRect(0f, HDR_H.toFloat(), CH_COL.toFloat(), vh, pChCol)

        // Header
        canvas.drawRect(0f, 0f, vw, HDR_H.toFloat(), pHdr)
        drawHeader(canvas, now, vw)

        // Column edge
        canvas.drawLine(CH_COL.toFloat(), 0f, CH_COL.toFloat(), vh, pSep)

        // Now-line dot at header bottom
        if (nowX in CH_COL.toFloat()..vw) {
            canvas.drawCircle(nowX, HDR_H.toFloat(), 5f * dp, pNowDot)
        }

        // Redraw channel cells on top of the left column
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

    // ── Header: date label left, 30-min time slots right ─────────────────────

    private fun drawHeader(canvas: Canvas, now: Long, vw: Float) {
        val hourMs = 3_600_000L
        val halfMs = hourMs / 2

        // Date / time in the channel-column area
        val dateStr = sdfDate.format(Date(now))
        val dateY   = HDR_H / 2f + tDate.textSize / 3
        canvas.drawText(dateStr, PAD.toFloat(), dateY, tDate)

        // Draw time labels every 30 min
        val firstSlot = (windowStartMs / halfMs) * halfMs
        var ms = firstSlot - halfMs
        while (true) {
            val slotStart = ms
            val x = CH_COL + (slotStart - windowStartMs) / 3_600_000f * SLOT_W - epgOffsetX
            ms += halfMs
            if (x > vw + SLOT_W) break
            if (x < CH_COL - SLOT_W) continue

            val isHour = slotStart % hourMs == 0L
            val isNowSlot = slotStart <= now && now < slotStart + halfMs
            val tickTop = if (isHour) HDR_H * 0.25f else HDR_H * 0.55f

            canvas.drawLine(x, tickTop, x, HDR_H.toFloat(), if (isHour) pSep else pHalfSep)
            canvas.drawText(
                sdfTime.format(Date(slotStart)),
                x + PAD * 0.5f,
                HDR_H / 2f + tTime.textSize / 3,
                if (isNowSlot) tTimeNow else tTime
            )
        }
    }

    // ── Row background + program timeline ────────────────────────────────────

    private fun drawRow(canvas: Canvas, idx: Int, ry: Float, now: Long, vw: Float) {
        val ch        = channels[idx]
        val isFocused = idx == focusedRow && hasFocus()
        val isCurrent = ch.id == currentId

        val bg = when { isFocused -> pFocusRow; isCurrent -> pCurrentRow; else -> pBg }
        canvas.drawRect(0f, ry, vw, ry + ROW_H, bg)

        // Left accent bar: full accent for focused, half-opacity for current
        when {
            isFocused  -> canvas.drawRect(0f, ry, 5f * dp, ry + ROW_H, pFocusBorder)
            isCurrent  -> canvas.drawRect(0f, ry, 4f * dp, ry + ROW_H, pCurrentBorder)
        }

        // Bottom row separator (only in timeline area)
        canvas.drawLine(0f, ry + ROW_H - dp, vw, ry + ROW_H - dp, pHalfSep)

        // Program blocks
        canvas.save()
        canvas.clipRect(CH_COL.toFloat(), ry, vw, ry + ROW_H)
        drawProgramBlocks(canvas, ch, ry, now, isFocused, vw)
        canvas.restore()
    }

    // ── Logo fetching ─────────────────────────────────────────────────────────

    private fun fetchLogo(url: String) {
        if (logoLoading.contains(url) || logoCache.get(url) != null) return
        logoLoading.add(url)
        scope.launch {
            try {
                val req = Request.Builder().url(url).build()
                val bytes = http.newCall(req).execute().use { it.body?.bytes() } ?: return@launch
                val raw = BitmapFactory.decodeByteArray(bytes, 0, bytes.size) ?: return@launch
                logoCache.put(url, raw)
                mainHandler.post { invalidate() }
            } catch (_: Exception) {
            } finally {
                logoLoading.remove(url)
            }
        }
    }

    // ── Channel column: number | logo circle | name ───────────────────────────

    private fun drawChannelCell(canvas: Canvas, idx: Int, ry: Float, now: Long) {
        val ch        = channels[idx]
        val isFocused = idx == focusedRow && hasFocus()
        val isCurrent = ch.id == currentId
        val cy        = ry + ROW_H / 2f

        // Channel number
        canvas.drawText(
            ch.number.toString(),
            CH_NUM / 2f,
            cy + (if (isFocused) tChNumFoc else tChNum).textSize * 0.38f,
            if (isFocused) tChNumFoc else tChNum
        )

        // Thin divider after number column
        canvas.drawLine(CH_NUM.toFloat(), ry + ROW_H * 0.15f, CH_NUM.toFloat(), ry + ROW_H * 0.85f, pHalfSep)

        // Logo circle — real bitmap if loaded, else initials fallback
        val cx = CH_NUM + CH_LOGO / 2f
        canvas.drawCircle(cx, cy, LOGO_R, if (isCurrent) pCircleCur else pCircle)
        val logoBitmap = ch.logo?.let { url -> logoCache.get(url).also { if (it == null) fetchLogo(url) } }
        if (logoBitmap != null) {
            val r = LOGO_R * 0.88f
            val left = cx - r; val top = cy - r; val right = cx + r; val bottom = cy + r
            logoClipPath.reset()
            logoClipPath.addCircle(cx, cy, r, Path.Direction.CW)
            canvas.save()
            canvas.clipPath(logoClipPath)
            canvas.drawBitmap(logoBitmap, null, RectF(left, top, right, bottom), logoPaint)
            canvas.restore()
        } else {
            val initials = ch.name.take(2).uppercase()
            canvas.drawText(initials, cx, cy + tInit.textSize * 0.37f, tInit)
        }

        // Play triangle for currently-playing channel
        if (isCurrent) {
            val s  = 6f * dp
            val ix = CH_NUM + CH_LOGO - s - 2f * dp
            val iy = cy - s * 0.7f
            playPath.reset()
            playPath.moveTo(ix, iy)
            playPath.lineTo(ix, iy + s * 1.4f)
            playPath.lineTo(ix + s * 1.2f, iy + s * 0.7f)
            playPath.close()
            canvas.drawPath(playPath, pPlayPath)
        }

        // Channel name
        val nx    = (CH_NUM + CH_LOGO + PAD * 0.6f)
        val nameW = (CH_NAME - PAD).toFloat()
        val nameP = if (isFocused) tChNameFoc else tChName

        val nowProg = programs[ch.id]?.find { it.startMs <= now && it.endMs > now }
        val nameY = if (nowProg != null) cy - nameP.textSize * 0.2f else cy + nameP.textSize * 0.38f
        drawEllipsis(canvas, ch.name, nx, nameY, nameW, nameP)

        if (nowProg != null) {
            drawEllipsis(canvas, nowProg.title, nx, cy + tChNow.textSize * 1.2f, nameW, tChNow)
        }

        // Catchup badge: small ◉ pill on the bottom-right of the logo circle
        if (ch.catchupAvailable) {
            val badgeR = 5.5f * dp
            val bx = cx + LOGO_R * 0.68f
            val by = cy + LOGO_R * 0.68f
            canvas.drawCircle(bx, by, badgeR, pCatchupBg)
            canvas.drawText("◉", bx, by + tCatchup.textSize * 0.37f, tCatchup)
        }
    }

    // ── Program blocks ────────────────────────────────────────────────────────

    private fun drawProgramBlocks(
        canvas: Canvas, ch: EpgChannel, ry: Float, now: Long, isFocused: Boolean, vw: Float
    ) {
        val progs = programs[ch.id]
        if (progs.isNullOrEmpty()) {
            canvas.drawText("No guide data",
                CH_COL + PAD.toFloat(),
                ry + ROW_H / 2f + tNoData.textSize / 3,
                tNoData)
            return
        }

        for (prog in progs) {
            val bx1 = CH_COL + (prog.startMs - windowStartMs) / 3_600_000f * SLOT_W - epgOffsetX
            val bx2 = CH_COL + (prog.endMs   - windowStartMs) / 3_600_000f * SLOT_W - epgOffsetX
            if (bx2 < CH_COL || bx1 > vw) continue

            val isNow  = prog.startMs <= now && prog.endMs > now
            val isPast = prog.endMs < now
            val bp     = when { isNow -> pBlockNow; isPast -> pBlockPast; else -> pBlockFut }

            blockRf.set(
                max(bx1, CH_COL.toFloat()) + dp,
                ry + 3f * dp,
                bx2 - dp,
                ry + ROW_H - 3f * dp
            )
            if (blockRf.width() < 2f * dp) continue

            canvas.drawRoundRect(blockRf, BLOCK_R, BLOCK_R, bp)
            canvas.drawRoundRect(blockRf, BLOCK_R, BLOCK_R, pBlockBrd)

            // Progress fill for current program
            if (isNow && prog.endMs > prog.startMs) {
                val frac = ((now - prog.startMs).toFloat() / (prog.endMs - prog.startMs)).coerceIn(0f, 1f)
                val px   = min(blockRf.left + blockRf.width() * frac, blockRf.right)
                canvas.drawRoundRect(RectF(blockRf.left, blockRf.top, px, blockRf.bottom), BLOCK_R, BLOCK_R, pProgress)
            }

            val tx     = blockRf.left + PAD * 0.6f
            val bw     = blockRf.width() - PAD * 1.2f
            val titleP = if (isNow) tBTNow else tBT
            val timeP  = if (isNow) tBTimeN else tBTime
            val ty1    = blockRf.top + titleP.textSize + 2f * dp
            drawEllipsis(canvas, prog.title, tx, ty1, bw, titleP)

            val ty2 = ty1 + timeP.textSize + 2f * dp
            if (ty2 + timeP.textSize < blockRf.bottom) {
                val timeStr = "${sdfTime.format(Date(prog.startMs))} – ${sdfTime.format(Date(prog.endMs))}"
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

    // ── Scroll ────────────────────────────────────────────────────────────────

    private fun nudge(dx: Float, dy: Float) {
        epgOffsetX = (epgOffsetX + dx).coerceIn(0f, maxOffX().toFloat())
        epgOffsetY = (epgOffsetY + dy).coerceIn(0f, maxOffY().toFloat())
        invalidate()
    }

    private fun maxOffX() = max(0, CH_COL + WIN_TOTAL_H * SLOT_W - width)
    private fun maxOffY() = max(0, channels.size * ROW_H - (height - HDR_H))

    private fun ensureVisible(idx: Int) {
        val top  = idx * ROW_H
        val bot  = top + ROW_H
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
                if (focusedRow > 0) { focusedRow--; ensureVisible(focusedRow); fireFocus(); invalidate() }
                return true
            }
            KeyEvent.KEYCODE_DPAD_DOWN -> {
                if (focusedRow < channels.lastIndex) { focusedRow++; ensureVisible(focusedRow); fireFocus(); invalidate() }
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

    private fun fireFocus() {
        val ch  = channels.getOrNull(focusedRow) ?: return
        val rc  = context as? ReactContext ?: return
        val now = System.currentTimeMillis()
        val prog = programs[ch.id]?.find { it.startMs <= now && it.endMs > now }
        rc.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(EVENT_CHANNEL_FOCUS, Arguments.createMap().apply {
                putString("channelId", ch.id)
                putString("channelName", ch.name)
                putInt("channelNumber", ch.number)
                if (prog != null) {
                    putString("programTitle", prog.title)
                    putString("programDesc",  prog.desc)
                    putDouble("programStart", prog.startMs.toDouble())
                    putDouble("programEnd",   prog.endMs.toDouble())
                }
            })
    }

    private fun fireProgramInfo(row: Int, touchX: Float?) {
        val ch  = channels.getOrNull(row) ?: return
        val rc  = context as? ReactContext ?: return
        val now = System.currentTimeMillis()
        val prog = if (touchX != null) {
            val tMs = windowStartMs + ((touchX - CH_COL + epgOffsetX) / SLOT_W * 3_600_000f).toLong()
            programs[ch.id]?.find { it.startMs <= tMs && it.endMs > tMs }
                ?: programs[ch.id]?.find { it.startMs <= now && it.endMs > now }
        } else {
            programs[ch.id]?.find { it.startMs <= now && it.endMs > now }
        } ?: return
        rc.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(EVENT_PROGRAM_INFO, Arguments.createMap().apply {
                putString("channelId",  ch.id)
                putString("channelName", ch.name)
                putString("programId",  prog.id)
                putString("title",      prog.title)
                putString("description", prog.desc)
                putDouble("startMs",    prog.startMs.toDouble())
                putDouble("endMs",      prog.endMs.toDouble())
                putBoolean("catchupAvailable", false)
            })
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        requestFocus()
        windowStartMs = System.currentTimeMillis() - WIN_BEFORE_H * 3_600_000L
        epgOffsetX = (WIN_BEFORE_H * SLOT_W).toFloat().coerceIn(0f, maxOffX().toFloat())
        maybeLoad()
    }

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        scope.cancel()
    }

    // ── Data classes ──────────────────────────────────────────────────────────

    data class EpgChannel(val id: String, val name: String, val logo: String?, val number: Int, val catchupAvailable: Boolean = false)
    data class EpgProgram(val id: String, val title: String, val desc: String, val startMs: Long, val endMs: Long)
}
