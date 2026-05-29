package com.chuchplayer.updater

import android.content.Intent
import android.content.pm.PackageManager
import android.util.Log
import androidx.core.content.FileProvider
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.TimeUnit

private const val TAG = "AppUpdaterModule"
private const val APK_FILENAME = "chuchplayer-update.apk"

class AppUpdaterModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "AppUpdaterModule"

    @ReactMethod
    fun getVersionCode(promise: Promise) {
        try {
            val info = reactContext.packageManager.getPackageInfo(reactContext.packageName, 0)
            @Suppress("DEPRECATION")
            promise.resolve(info.versionCode)
        } catch (e: PackageManager.NameNotFoundException) {
            promise.reject("VERSION_ERROR", e)
        }
    }

    /** Downloads APK from [apkUrl], reporting progress via events, then triggers install. */
    @ReactMethod
    fun downloadAndInstall(apkUrl: String, promise: Promise) {
        Thread {
            try {
                val client = OkHttpClient.Builder()
                    .connectTimeout(30, TimeUnit.SECONDS)
                    .readTimeout(120, TimeUnit.SECONDS)
                    .build()

                val request = Request.Builder().url(apkUrl).build()
                val response = client.newCall(request).execute()

                if (!response.isSuccessful) {
                    promise.reject("DOWNLOAD_ERROR", "HTTP ${response.code}")
                    return@Thread
                }

                val body = response.body ?: run {
                    promise.reject("DOWNLOAD_ERROR", "Empty response body")
                    return@Thread
                }

                val outFile = File(reactContext.cacheDir, APK_FILENAME)
                val totalBytes = body.contentLength()
                var downloadedBytes = 0L

                body.byteStream().use { input ->
                    FileOutputStream(outFile).use { output ->
                        val buf = ByteArray(8192)
                        var read: Int
                        while (input.read(buf).also { read = it } != -1) {
                            output.write(buf, 0, read)
                            downloadedBytes += read
                            if (totalBytes > 0) {
                                val pct = (downloadedBytes * 100 / totalBytes).toInt()
                                emitProgress(pct)
                            }
                        }
                    }
                }

                emitProgress(100)
                installApk(outFile)
                promise.resolve(null)
            } catch (e: Exception) {
                Log.e(TAG, "downloadAndInstall failed", e)
                promise.reject("DOWNLOAD_ERROR", e.message, e)
            }
        }.start()
    }

    private fun installApk(file: File) {
        val uri = FileProvider.getUriForFile(
            reactContext,
            "${reactContext.packageName}.updater.provider",
            file,
        )
        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/vnd.android.package-archive")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        reactContext.startActivity(intent)
    }

    private fun emitProgress(percent: Int) {
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit("APP_UPDATE_PROGRESS", percent)
    }

    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}
}
