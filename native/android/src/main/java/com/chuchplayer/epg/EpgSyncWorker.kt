package com.chuchplayer.epg

import android.content.Context
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import io.realm.Realm
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.*
import java.util.concurrent.TimeUnit

class EpgSyncWorker(context: Context, params: WorkerParameters) :
    CoroutineWorker(context, params) {

    companion object {
        private const val TAG              = "EpgSyncWorker"
        private const val PREF_NAME        = "epg_sync_prefs"
        private const val KEY_LAST_SYNC    = "last_sync_"
        private const val SYNC_HOURS       = 4L
        private const val SYNC_INTERVAL_MS = SYNC_HOURS * 3_600_000L
    }

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        try {
            Realm.init(applicationContext)
        } catch (_: IllegalStateException) {
            // Realm is already initialized.
        }
        val epgUrl          = inputData.getString("epgUrl")          ?: return@withContext Result.failure()
        val resolvedEpgUrl  = resolveEpgUrl(epgUrl)
        val playlistId      = inputData.getString("playlistId")      ?: return@withContext Result.failure()
        val channelsPath    = inputData.getString("channelsPath")    ?: return@withContext Result.failure()
        val sigRaw          = inputData.getString("datasetSignature")
        val datasetSig      = if (sigRaw.isNullOrEmpty()) null else sigRaw

        val channelsFile = java.io.File(channelsPath)
        if (!channelsFile.exists()) {
            Log.e(TAG, "Channels file missing at $channelsPath")
            return@withContext Result.failure()
        }
        Log.d(TAG, "Background EPG sync: playlist=$playlistId")

        val prefs      = applicationContext.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
        val lastSyncKey = KEY_LAST_SYNC + playlistId + "_" + resolvedEpgUrl.hashCode()
        val lastSync    = prefs.getLong(lastSyncKey, 0L)
        val now         = System.currentTimeMillis()

        if (lastSync > 0 && (now - lastSync) < SYNC_INTERVAL_MS) {
            Log.d(TAG, "Skipping — synced ${(now - lastSync) / 3_600_000}h ago")
            return@withContext Result.success()
        }

        try {
            if (foregroundIngestionCount.get() > 0) {
                Log.d(TAG, "Skipping — foreground EPG import is active")
                return@withContext Result.retry()
            }
            if (!epgIngestionMutex.tryLock()) {
                Log.d(TAG, "Skipping — another EPG import is active")
                return@withContext Result.retry()
            }
            try {
                val channelsJson = try {
                    channelsFile.readText()
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to read channels file", e)
                    return@withContext Result.failure()
                }
                val body = fetchEpg(resolvedEpgUrl) ?: return@withContext Result.retry()
                val channelIndex = parseChannelsJson(channelsJson)
                var inserted = 0
                body.use {
                    if (isStopped || foregroundIngestionCount.get() > 0) {
                        return@withContext Result.retry()
                    }
                    val parsed = streamXmlPrograms(it.byteStream(), playlistId, channelIndex) { batch ->
                        if (isStopped || foregroundIngestionCount.get() > 0) {
                            throw kotlinx.coroutines.CancellationException()
                        }
                        inserted += writeProgramsToRealm(batch)
                    }
                    Log.d(TAG, "Parsed $parsed programs")
                }

                Log.d(TAG, "Inserted $inserted programs")
                if (datasetSig != null) updatePlaylistMetadata(playlistId, datasetSig)
                prefs.edit().putLong(lastSyncKey, now).apply()
                Log.d(TAG, "Background sync complete")
                Result.success()
            } finally {
                epgIngestionMutex.unlock()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Background sync failed", e)
            Result.retry()
        }
    }

    private suspend fun fetchEpg(url: String): okhttp3.ResponseBody? {
        val client = OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(120, TimeUnit.SECONDS)
            .build()
        val request = Request.Builder()
            .url(url)
            .header("User-Agent", "chuchPlayer/1.0")
            .header("Accept", "application/xml, text/xml, */*")
            .build()

        repeat(3) { attempt ->
            try {
                val response = client.newCall(request).execute()
                if (response.code == 429) {
                    response.close()
                    Log.w(TAG, "429 rate-limited on attempt ${attempt + 1}")
                    return Result.retry().let { null }
                }
                if (!response.isSuccessful) {
                    response.close()
                    Log.e(TAG, "HTTP ${response.code}")
                    return null
                }
                return response.body
            } catch (e: Exception) {
                Log.w(TAG, "Request failed (attempt ${attempt + 1})", e)
            }
        }
        return null
    }
}
