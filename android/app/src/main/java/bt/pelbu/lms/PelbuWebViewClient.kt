package bt.pelbu.lms

import android.content.Intent
import android.net.Uri
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient

/**
 * LMS pages stay in the WebView. Google sign-in uses the Android account
 * picker. Facebook / Apple open in Chrome Auth Tab. `/auth/callback` is
 * loaded back in this WebView so the session cookies stay put.
 */
class PelbuWebViewClient(
    private val activity: MainActivity,
) : WebViewClient() {

    override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
        if (!request.isForMainFrame) return false
        return handleUri(request.url)
    }

    fun handleUri(uri: Uri): Boolean {
        val url = uri.toString()

        if (url.startsWith("mailto:") || url.startsWith("tel:") || url.startsWith("sms:")) {
            return launchExternal(uri)
        }

        if (isOAuthAuthorization(uri)) {
            activity.openOAuth(url)
            return true
        }

        if (isAllowedHost(uri.host)) {
            return false
        }

        return launchExternal(uri)
    }

    override fun onReceivedError(
        view: WebView,
        request: WebResourceRequest,
        error: WebResourceError,
    ) {
        if (request.isForMainFrame) {
            activity.showOffline(true)
        }
    }

    override fun onPageFinished(view: WebView, url: String?) {
        activity.showOffline(false)
        activity.setRefreshing(false)
    }

    private fun isOAuthAuthorization(uri: Uri): Boolean {
        val host = uri.host ?: return false
        if (host == "accounts.google.com") return true
        if (host.endsWith(".google.com") && host.contains("accounts")) return true
        if (host == "appleid.apple.com") return true
        if (host == "facebook.com" || host == "www.facebook.com" || host == "m.facebook.com" || host.endsWith(".facebook.com")) {
            return true
        }
        val path = uri.path.orEmpty()
        return host.endsWith(".supabase.co") && path.contains("/auth/v1/authorize")
    }

    private fun isAllowedHost(host: String?): Boolean {
        if (host.isNullOrBlank()) return false
        val root = BuildConfig.LMS_HOST.removePrefix("www.")
        return host == root ||
            host == "www.$root" ||
            host == "pelbu.bt" ||
            host == "www.pelbu.bt" ||
            host.endsWith(".supabase.co") ||
            host.endsWith(".cloudinary.com")
    }

    private fun launchExternal(uri: Uri): Boolean {
        return try {
            activity.startActivity(Intent(Intent.ACTION_VIEW, uri))
            true
        } catch (_: Exception) {
            false
        }
    }
}
