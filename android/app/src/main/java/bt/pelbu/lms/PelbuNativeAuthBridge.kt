package bt.pelbu.lms

import android.webkit.JavascriptInterface

/**
 * Bridge from the LMS page into native auth. Google uses Credential Manager
 * so the phone's Google accounts appear in the system picker.
 */
class PelbuNativeAuthBridge(
    private val activity: MainActivity,
) {
    @JavascriptInterface
    fun openOAuth(url: String) {
        activity.runOnUiThread { activity.openOAuth(url) }
    }

    @JavascriptInterface
    fun signInWithGoogle() {
        activity.runOnUiThread { activity.startNativeGoogleSignIn() }
    }

    @JavascriptInterface
    fun pendingGoogleIdToken(): String {
        return activity.pendingGoogleIdToken().orEmpty()
    }
}
