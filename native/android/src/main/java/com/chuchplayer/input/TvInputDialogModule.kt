package com.chuchplayer.input

import android.app.AlertDialog
import android.text.InputType
import android.view.inputmethod.InputMethodManager
import android.widget.EditText
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class TvInputDialogModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "TvInputDialogModule"

    @ReactMethod
    fun promptText(
        title: String,
        initialValue: String,
        secureTextEntry: Boolean,
        keyboardType: String,
        promise: Promise,
    ) {
        val activity = getCurrentActivity()
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "No active Android activity")
            return
        }

        activity.runOnUiThread {
            val input = EditText(activity).apply {
                setSingleLine(true)
                setText(initialValue)
                setSelection(text.length)
                inputType = when {
                    secureTextEntry ->
                        InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
                    keyboardType == "url" ->
                        InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_URI
                    else ->
                        InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_NORMAL
                }
            }

            val dialog = AlertDialog.Builder(activity)
                .setTitle(title)
                .setView(input)
                .setNegativeButton("Cancel") { _, _ -> promise.resolve(null) }
                .setPositiveButton("OK") { _, _ -> promise.resolve(input.text.toString()) }
                .create()

            dialog.setOnShowListener {
                input.requestFocus()
                dialog.window?.setSoftInputMode(android.view.WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_VISIBLE)
                input.postDelayed({
                    val imm = activity.getSystemService(InputMethodManager::class.java)
                    imm?.showSoftInput(input, InputMethodManager.SHOW_IMPLICIT)
                }, 150)
            }

            dialog.setOnCancelListener { promise.resolve(null) }
            dialog.show()
        }
    }
}
