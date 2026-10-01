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
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.sync.withPermit
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
        const val EVENT_CATCHUP_SELECT = "EPG_CATCHUP_SELECT"
        const val EVENT_PROGRAM_INFO   = "EPG_PROGRAM_INFO"
        const val EVENT_CHANNEL_FOCUS  = "EPG_CHANNEL_FOCUS"
        const val EVENT_OPEN_GROUPS    = "EPG_OPEN_GROUPS"
        private const val WIN_CATCHUP_H = 72  // how far back users can scroll (3 days)
        private const val QUERY_BATCH_SIZE = 8
        private const val PREFETCH_AHEAD = 24
        private const val PREFETCH_BEHIND = 12
        private const val PREFETCH_BLOCK = 8
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

    // ── Time window: WIN_CATCHUP_H back … now+11h ────────────────────────────
    private val WIN_BEFORE_H = WIN_CATCHUP_H  // window starts 3 days back
    private val WIN_TOTAL_H  = 12
    private var windowStartMs = System.currentTimeMillis() - WIN_CATCHUP_H * 3_600_000L

    // ── State ─────────────────────────────────────────────────────────────────
    private var channels    = emptyList<EpgChannel>()
    private val programs = LruCache<String, CachedPrograms>(96)
    private var guideLoading = false
    private var hasGuideData = false
    private var requestedIds = emptyList<String>()
    private var queryGeneration = 0
    private var dataRevision = 0
    private var queryJob: Job? = null
    private val queryMutex = Mutex()
    private var lastVisibleRow = 0
    private var lastFocusedRow = 0
    private var scrollDirection = 1
    private var currentId: String? = null
    private var playlistId: String? = null
    private var focusedRow  = 0
    private var epgOffsetX  = 0f
    private var epgOffsetY  = 0f
    // cursorMs: the time position the user navigated to with left/right D-pad.
    // Starts at "now". Moving left goes into the past for catchup browsing.
    private var cursorMs: Long = System.currentTimeMillis()

    private val scope       = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val mainHandler = Handler(Looper.getMainLooper())

    // ── Logo image cache ──────────────────────────────────────────────────────
    private val logoCache = object : LruCache<String, Bitmap>(16 * 1024 * 1024) {
        override fun sizeOf(key: String, value: Bitmap) = value.byteCount
    }
    private val logoLoading = java.util.Collections.synchronizedSet(mutableSetOf<String>())
    private val logoFailures = LruCache<String, Long>(128)
    private val logoRequests = Semaphore(3)
    private val http = OkHttpClient.Builder()
        .connectTimeout(5, TimeUnit.SECONDS)
        .readTimeout(5, TimeUnit.SECONDS)
        .followRedirects(true)
        .followSslRedirects(true)
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
            if (row in channels.indices) { focusedRow = row; maybeLoad(); fireSelect(); invalidate() }
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
    private val pCatchupBg   = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFF1B3D5A.toInt() }
    private val tCatchup     = buildText(0xFF5AAAD0.toInt(), 8.5f, bold = true, center = true)
    // Past programs on catchup channels — teal tint to signal they're playable
    private val pBlockCatchupPast = Paint().apply { color = 0xFF0E2E38.toInt() }
    private val tBTCatchup   = buildText(0xFF5AAAD0.toInt(), 12f)   // catchup block title
    private val tBTimeCatchup= buildText(0xFF3A7A95.toInt(), 10f)   // catchup block time
    // Cursor (movable time selection line)
    private val pCursor      = Paint().apply { color = 0xCCFFFFFF.toInt(); strokeWidth = 2f * dp }
    private val pCursorHl    = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0x22FFFFFF; style = Paint.Style.FILL }

    private fun buildText(
        color: Int, spSize: Float, bold: Boolean = false, center: Boolean = false
    ) = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        this.color = color
        textSize  = spSize * dp
        typeface  = if (bold) Typeface.create(Typeface.DEFAULT, Typeface.BOLD) else Typeface.DEFAULT
        textAlign = if (center) Paint.Align.CENTER else Paint.Align.LEFT
    }

    private val blockRf   = RectF()
    private val progressRf = RectF()
    private val logoRf = RectF()
    private val sdfTime   = SimpleDateFormat("h:mm a", Locale.getDefault())
    private val sdfDate   = SimpleDateFormat("EEE, MMM d  h:mm a", Locale.getDefault())
    private val timeLabels = LruCache<Long, String>(512)
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
            // Catchup-past blocks: dark tint of accent
            pBlockCatchupPast.color = Color.argb(0xFF,
                (Color.red(c)   * 0.08f).toInt(),
                (Color.green(c) * 0.12f).toInt(),
                (Color.blue(c)  * 0.20f).toInt())
            tBTCatchup.color = Color.argb(0xFF,
                (Color.red(c)   * 0.55f + 60  * 0.45f).toInt().coerceIn(0,255),
                (Color.green(c) * 0.55f + 130 * 0.45f).toInt().coerceIn(0,255),
                (Color.blue(c)  * 0.55f + 180 * 0.45f).toInt().coerceIn(0,255))
            tBTimeCatchup.color = Color.argb(0xBB,
                (Color.red(c)   * 0.4f + 40  * 0.6f).toInt().coerceIn(0,255),
                (Color.green(c) * 0.4f + 100 * 0.6f).toInt().coerceIn(0,255),
                (Color.blue(c)  * 0.4f + 140 * 0.6f).toInt().coerceIn(0,255))
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
        if (playlistId != id) {
            queryJob?.cancel()
            queryJob = null
            queryGeneration++
            programs.evictAll()
            hasGuideData = false
            requestedIds = emptyList()
        }
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
        queryJob?.cancel()
        queryJob = null
        queryGeneration++
        programs.evictAll()
        hasGuideData = false
        requestedIds = emptyList()
        val idx = channels.indexOfFirst { it.id == currentId }.coerceAtLeast(0)
        focusedRow = idx
        ensureVisible(idx)
        lastFocusedRow = idx
        lastVisibleRow = (epgOffsetY / ROW_H).toInt()
        scrollDirection = 1
        maybeLoad()
        fireFocus()
        invalidate()
    }

    fun setCurrentChannelId(id: String?) {
        currentId = id
        val idx = channels.indexOfFirst { it.id == id }
        if (idx >= 0) { focusedRow = idx; ensureVisible(idx) }
        maybeLoad()
        invalidate()
    }

    fun setGuideLoading(loading: Boolean) {
        guideLoading = loading
        invalidate()
    }

    // ── Realm load ────────────────────────────────────────────────────────────

    fun maybeLoad(force: Boolean = false) {
        if (force) dataRevision++
        if (playlistId == null) return
        if (channels.isEmpty()) return
        val visibleRows = max(1, (height - HDR_H) / ROW_H + 1)
        val firstVisible = (epgOffsetY / ROW_H).toInt().coerceIn(0, channels.lastIndex)
        val lastVisible = min(channels.lastIndex, firstVisible + visibleRows)
        scrollDirection = when {
            firstVisible > lastVisibleRow || focusedRow > lastFocusedRow -> 1
            firstVisible < lastVisibleRow || focusedRow < lastFocusedRow -> -1
            else -> scrollDirection
        }
        lastVisibleRow = firstVisible
        lastFocusedRow = focusedRow

        val before = if (scrollDirection < 0) PREFETCH_AHEAD else PREFETCH_BEHIND
        val after = if (scrollDirection > 0) PREFETCH_AHEAD else PREFETCH_BEHIND
        val first = max(0, firstVisible - before) / PREFETCH_BLOCK * PREFETCH_BLOCK
        val last = min(channels.lastIndex, (lastVisible + after + PREFETCH_BLOCK) / PREFETCH_BLOCK * PREFETCH_BLOCK - 1)
        val ids = linkedSetOf(channels[focusedRow].id)
        val visibleRange = if (scrollDirection > 0) firstVisible..lastVisible else lastVisible downTo firstVisible
        visibleRange.forEach { ids.add(channels[it].id) }
        if (scrollDirection > 0) {
            for (row in lastVisible + 1..last) ids.add(channels[row].id)
            for (row in firstVisible - 1 downTo first) ids.add(channels[row].id)
        } else {
            for (row in firstVisible - 1 downTo first) ids.add(channels[row].id)
            for (row in lastVisible + 1..last) ids.add(channels[row].id)
        }
        requestedIds = ids.toList()
        loadNextBatch()
    }

    private fun loadNextBatch() {
        val pid = playlistId ?: return
        // Let each batch finish so repeated D-pad presses cannot starve visible rows.
        if (queryJob != null) return
        val revision = dataRevision
        val queryIds = requestedIds.filter { programs.get(it)?.revision != revision }.take(QUERY_BATCH_SIZE)
        if (queryIds.isEmpty()) return
        val generation = queryGeneration
        queryJob = scope.launch {
            try {
                val result = queryMutex.withLock {
                    ensureActive()
                    val realm = openRealm()
                    val now = System.currentTimeMillis()
                    val lower = Date(now - WIN_CATCHUP_H * 3_600_000L)
                    val upper = Date(now + HOURS_AFTER * 3_600_000L)
                    val grouped = queryIds.associateWith { mutableListOf<EpgProgram>() }
                    try {
                        val rows = realm.where(ProgramRealm::class.java)
                            .equalTo("playlistId", pid)
                            .`in`("channelId", queryIds.toTypedArray())
                            .greaterThan("end", lower)
                            .lessThan("start", upper)
                            .findAll()
                        rows.forEach { p ->
                            ensureActive()
                            grouped[p.channelId]?.add(EpgProgram(p.id, p.title, p.description ?: "", p.start.time, p.end.time))
                        }
                    } finally { realm.close() }
                    grouped
                }
                ensureActive()
                mainHandler.post {
                    if (generation != queryGeneration) return@post
                    queryJob = null
                    result.forEach { (id, rows) -> programs.put(id, CachedPrograms(revision, rows)) }
                    hasGuideData = programs.snapshot().values.any { it.rows.isNotEmpty() }
                    fireFocus()
                    invalidate()
                    loadNextBatch()
                }
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                Log.e(TAG, "realm load", e)
                mainHandler.post {
                    if (generation == queryGeneration) queryJob = null
                }
            }
        }
    }

    // ── Draw ─────────────────────────────────────────────────────────────────

    override fun onDraw(canvas: Canvas) {
        val vw  = width.toFloat()
        val vh  = height.toFloat()
        val now = System.currentTimeMillis()
        val firstRow = max(0, (epgOffsetY / ROW_H).toInt())
        val lastRow = min(channels.lastIndex, ((epgOffsetY + vh - HDR_H) / ROW_H).toInt())

        canvas.drawRect(0f, 0f, vw, vh, pBg)

        // ── Rows (clipped below header) ──────────────────────────────────────
        canvas.save()
        canvas.clipRect(0f, HDR_H.toFloat(), vw, vh)
        for (i in firstRow..lastRow) {
            val ry = HDR_H + i * ROW_H - epgOffsetY
            drawRow(canvas, i, ry, now, vw)
        }
        // Current-time vertical line
        val nowX = nowLineX(now)
        if (nowX in CH_COL.toFloat()..vw) {
            canvas.drawLine(nowX, HDR_H.toFloat(), nowX, vh, pNowLine)
        }
        // User cursor line (only shown when it differs from now by >1 min)
        val cursorX = cursorLineX()
        if (kotlin.math.abs(cursorMs - now) > 60_000L && cursorX in CH_COL.toFloat()..vw) {
            canvas.drawLine(cursorX, HDR_H.toFloat(), cursorX, vh, pCursor)
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
        // Cursor dot at header bottom (only when in past/future)
        if (kotlin.math.abs(cursorMs - now) > 60_000L && cursorX in CH_COL.toFloat()..vw) {
            canvas.drawCircle(cursorX, HDR_H.toFloat(), 4f * dp, pCursor)
        }

        // Redraw channel cells on top of the left column
        canvas.save()
        canvas.clipRect(0f, HDR_H.toFloat(), CH_COL.toFloat(), vh)
        for (i in firstRow..lastRow) {
            val ry = HDR_H + i * ROW_H - epgOffsetY
            drawChannelCell(canvas, i, ry, now)
        }
        canvas.restore()
    }

    private fun nowLineX(now: Long) =
        CH_COL + (now - windowStartMs) / 3_600_000f * SLOT_W - epgOffsetX

    private fun cursorLineX() =
        CH_COL + (cursorMs - windowStartMs) / 3_600_000f * SLOT_W - epgOffsetX

    // ── Header: date label left, 30-min time slots right ─────────────────────

    private fun drawHeader(canvas: Canvas, now: Long, vw: Float) {
        val hourMs = 3_600_000L
        val halfMs = hourMs / 2

        // Date / time in the channel-column area
        val dateStr = sdfDate.format(Date(now))
        val dateY   = HDR_H / 2f + tDate.textSize / 3
        canvas.drawText(dateStr, PAD.toFloat(), dateY, tDate)

        // Draw time labels every 30 min
        val visibleStart = windowStartMs + (epgOffsetX / SLOT_W * hourMs).toLong()
        val firstSlot = (visibleStart / halfMs) * halfMs
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
                timeLabel(slotStart),
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
        if (logoCache.get(url) != null) return
        val failedAt = logoFailures.get(url)
        if (failedAt != null && System.currentTimeMillis() - failedAt < 60_000L) return
        if (!logoLoading.add(url)) return
        scope.launch {
            var loaded = false
            try {
                logoRequests.withPermit {
                    ensureActive()
                    val req = Request.Builder().url(url).build()
                    val bytes = http.newCall(req).execute().use {
                        if (it.isSuccessful) it.body?.bytes() else null
                    } ?: return@withPermit
                    val raw = decodeLogoBitmap(bytes, (LOGO_R * 2f).toInt()) ?: return@withPermit
                    logoCache.put(url, raw)
                    loaded = true
                    mainHandler.post { invalidate() }
                }
            } catch (e: CancellationException) {
                throw e
            } catch (_: Exception) {
            } finally {
                if (!loaded) logoFailures.put(url, System.currentTimeMillis())
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
            ch.numberLabel,
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
            logoRf.set(left, top, right, bottom)
            canvas.drawBitmap(logoBitmap, null, logoRf, logoPaint)
            canvas.restore()
        } else {
            canvas.drawText(ch.initials, cx, cy + tInit.textSize * 0.37f, tInit)
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

        val nowProg = programs[ch.id]?.rows?.find { it.startMs <= now && it.endMs > now }
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
        val progs = programs[ch.id]?.rows
        if (progs.isNullOrEmpty()) {
            canvas.drawText(if (guideLoading) "Loading guide…" else "No guide data",
                CH_COL + PAD.toFloat(),
                ry + ROW_H / 2f + tNoData.textSize / 3,
                tNoData)
            return
        }

        for (prog in progs) {
            val bx1 = CH_COL + (prog.startMs - windowStartMs) / 3_600_000f * SLOT_W - epgOffsetX
            val bx2 = CH_COL + (prog.endMs   - windowStartMs) / 3_600_000f * SLOT_W - epgOffsetX
            if (bx2 < CH_COL || bx1 > vw) continue

            val isNow         = prog.startMs <= now && prog.endMs > now
            val isPast        = prog.endMs < now
            val isCatchupPast = isPast && ch.catchupAvailable
            val isUnderCursor = prog.startMs <= cursorMs && prog.endMs > cursorMs && isFocused
            val bp = when {
                isNow         -> pBlockNow
                isCatchupPast -> pBlockCatchupPast   // selectable past on catchup channel
                isPast        -> pBlockPast           // dim — not available
                else          -> pBlockFut
            }

            blockRf.set(
                max(bx1, CH_COL.toFloat()) + dp,
                ry + 3f * dp,
                bx2 - dp,
                ry + ROW_H - 3f * dp
            )
            if (blockRf.width() < 2f * dp) continue

            canvas.drawRoundRect(blockRf, BLOCK_R, BLOCK_R, bp)
            canvas.drawRoundRect(blockRf, BLOCK_R, BLOCK_R, pBlockBrd)

            // Cursor highlight overlay on the selected block
            if (isUnderCursor) {
                canvas.drawRoundRect(blockRf, BLOCK_R, BLOCK_R, pCursorHl)
            }

            // Progress fill for current program
            if (isNow && prog.endMs > prog.startMs) {
                val frac = ((now - prog.startMs).toFloat() / (prog.endMs - prog.startMs)).coerceIn(0f, 1f)
                val px   = min(blockRf.left + blockRf.width() * frac, blockRf.right)
                progressRf.set(blockRf.left, blockRf.top, px, blockRf.bottom)
                canvas.drawRoundRect(progressRf, BLOCK_R, BLOCK_R, pProgress)
            }

            val tx     = blockRf.left + PAD * 0.6f
            val bw     = blockRf.width() - PAD * 1.2f
            val titleP = when { isNow -> tBTNow; isCatchupPast -> tBTCatchup; else -> tBT }
            val timeP  = when { isNow -> tBTimeN; isCatchupPast -> tBTimeCatchup; else -> tBTime }
            val ty1    = blockRf.top + titleP.textSize + 2f * dp
            drawEllipsis(canvas, prog.title, tx, ty1, bw, titleP)

            val ty2 = ty1 + timeP.textSize + 2f * dp
            if (ty2 + timeP.textSize < blockRf.bottom) {
                val timeStr = "${timeLabel(prog.startMs)} – ${timeLabel(prog.endMs)}"
                drawEllipsis(canvas, timeStr, tx, ty2, bw, timeP)
            }
        }
    }

    private fun drawEllipsis(canvas: Canvas, text: String, x: Float, y: Float, maxW: Float, p: Paint) {
        if (maxW <= 0 || text.isEmpty()) return
        if (p.measureText(text) <= maxW) { canvas.drawText(text, x, y, p); return }
        val ellW = p.measureText("…")
        if (ellW > maxW) return
        val n = p.breakText(text, true, maxW - ellW, null)
        canvas.drawText(text.substring(0, n) + "…", x, y, p)
    }

    private fun timeLabel(timestamp: Long): String =
        timeLabels.get(timestamp) ?: sdfTime.format(Date(timestamp)).also { timeLabels.put(timestamp, it) }

    // ── Scroll ────────────────────────────────────────────────────────────────

    private fun nudge(dx: Float, dy: Float) {
        epgOffsetX = (epgOffsetX + dx).coerceIn(0f, maxOffX().toFloat())
        epgOffsetY = (epgOffsetY + dy).coerceIn(0f, maxOffY().toFloat())
        maybeLoad()
        invalidate()
    }

    private fun maxOffX() = max(0, (WIN_CATCHUP_H + WIN_TOTAL_H).toInt() * SLOT_W + CH_COL - width)
    private fun maxOffY() = max(0, channels.size * ROW_H - (height - HDR_H))

    // Keep cursor on-screen after a D-pad left/right move.
    private fun scrollToCursor() {
        val targetX = (cursorMs - windowStartMs) / 3_600_000f * SLOT_W
        val margin  = SLOT_W * 1.5f
        val viewW   = width.toFloat()
        epgOffsetX = when {
            targetX - epgOffsetX < margin ->
                (targetX - margin).coerceIn(0f, maxOffX().toFloat())
            targetX - epgOffsetX > viewW - CH_COL - margin ->
                (targetX - (viewW - CH_COL) + margin).coerceIn(0f, maxOffX().toFloat())
            else -> epgOffsetX
        }
    }

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
            maybeLoad()
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
                if (focusedRow > 0) { focusedRow--; ensureVisible(focusedRow); maybeLoad(); fireFocus(); invalidate() }
                return true
            }
            KeyEvent.KEYCODE_DPAD_DOWN -> {
                if (focusedRow < channels.lastIndex) { focusedRow++; ensureVisible(focusedRow); maybeLoad(); fireFocus(); invalidate() }
                return true
            }
            KeyEvent.KEYCODE_DPAD_LEFT -> {
                fireOpenGroups()
                return true
            }
            KeyEvent.KEYCODE_DPAD_RIGHT -> {
                // Move cursor 30 min forward, cap at end of guide window
                cursorMs = (cursorMs + 1_800_000L)
                    .coerceAtMost(windowStartMs + (WIN_CATCHUP_H + WIN_TOTAL_H) * 3_600_000L)
                scrollToCursor()
                invalidate()
                return true
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
        val ch  = channels.getOrNull(focusedRow) ?: return
        val rc  = context as? ReactContext ?: return
        val now = System.currentTimeMillis()

        // If cursor is in the past and this channel has catchup, fire a catchup event
        if (cursorMs < now - 60_000L && ch.catchupAvailable) {
            val prog = programs[ch.id]?.rows?.find { it.startMs <= cursorMs && it.endMs > cursorMs }
            if (prog != null) {
                rc.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    .emit(EVENT_CATCHUP_SELECT, Arguments.createMap().apply {
                        putString("channelId",    ch.id)
                        putString("channelName",  ch.name)
                        putDouble("startMs",      prog.startMs.toDouble())
                        putDouble("endMs",        prog.endMs.toDouble())
                        putString("programTitle", prog.title)
                    })
                return
            }
        }

        // Normal live channel select
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
        val prog = programs[ch.id]?.rows?.find { it.startMs <= now && it.endMs > now }
        rc.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(EVENT_CHANNEL_FOCUS, Arguments.createMap().apply {
                putString("channelId", ch.id)
                putString("channelName", ch.name)
                putInt("channelNumber", ch.number)
                putBoolean("hasGuideData", hasGuideData)
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
        // Use touched time or cursor position to find the right program
        val lookupMs = if (touchX != null)
            windowStartMs + ((touchX - CH_COL + epgOffsetX) / SLOT_W * 3_600_000f).toLong()
        else
            cursorMs
        val prog = programs[ch.id]?.rows?.find { it.startMs <= lookupMs && it.endMs > lookupMs }
            ?: programs[ch.id]?.rows?.find { it.startMs <= now && it.endMs > now }
            ?: return
        val isPast = prog.endMs < now
        rc.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(EVENT_PROGRAM_INFO, Arguments.createMap().apply {
                putString("channelId",       ch.id)
                putString("channelName",     ch.name)
                putString("programId",       prog.id)
                putString("title",           prog.title)
                putString("description",     prog.desc)
                putDouble("startMs",         prog.startMs.toDouble())
                putDouble("endMs",           prog.endMs.toDouble())
                putBoolean("catchupAvailable", isPast && ch.catchupAvailable)
            })
    }

    private fun fireOpenGroups() {
        val ch = channels.getOrNull(focusedRow)
        (context as? ReactContext)
            ?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            ?.emit(EVENT_OPEN_GROUPS, Arguments.createMap().apply {
                if (ch != null) {
                    putString("channelId", ch.id)
                    putString("channelName", ch.name)
                }
            })
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        requestFocus()
        val now = System.currentTimeMillis()
        windowStartMs = now - WIN_CATCHUP_H * 3_600_000L
        cursorMs = now
        // Scroll so "now" is ~1.5 slots from the left edge of the timeline
        epgOffsetX = (WIN_CATCHUP_H * SLOT_W - SLOT_W * 1.5f)
            .coerceIn(0f, maxOffX().toFloat())
        maybeLoad()
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)
        if (channels.isNotEmpty()) {
            ensureVisible(focusedRow)
            maybeLoad()
        }
    }

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        queryGeneration++
        queryJob = null
        scope.cancel()
    }

    // ── Data classes ──────────────────────────────────────────────────────────

    data class EpgChannel(val id: String, val name: String, val logo: String?, val number: Int, val catchupAvailable: Boolean = false) {
        val initials = name.take(2).uppercase()
        val numberLabel = number.toString()
    }
    private data class CachedPrograms(val revision: Int, val rows: List<EpgProgram>)
    data class EpgProgram(val id: String, val title: String, val desc: String, val startMs: Long, val endMs: Long)
}
