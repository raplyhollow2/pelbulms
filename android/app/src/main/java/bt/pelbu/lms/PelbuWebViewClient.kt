package bt.pelbu.lms

import android.content.Intent
import android.net.Uri
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient

/**
 * Keeps LMS + OAuth (Google/Facebook/Apple) inside the same WebView so Supabase
 * PKCE code-verifier cookies set on login stay available on /auth/callback.
 * Custom Tabs use a separate cookie jar and break PKCE.
 */
class PelbuWebViewClient(
    private val activity: MainActivity,
) : WebViewClient() {

    override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
        return handleUri(request.url)
    }

    fun handleUri(uri: Uri): Boolean {
        val url = uri.toString()

        if (url.startsWith("mailto:") || url.startsWith("tel:") || url.startsWith("sms:")) {
            return launchExternal(uri)
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

    private fun isAllowedHost(host: String?): Boolean {
        if (host.isNullOrBlank()) return false
        val root = BuildConfig.LMS_HOST.removePrefix("www.")
        return host == root ||
            host == "www.$root" ||
            host == "pelbu.bt" ||
            host == "www.pelbu.bt" ||
            host.endsWith(".supabase.co") ||
            host.endsWith(".cloudinary.com") ||
            // OAuth IdPs must stay in-WebView for PKCE cookie continuity
            host == "accounts.google.com" ||
            (host.endsWith(".google.com") && host.contains("accounts")) ||
            host == "www.facebook.com" ||
            host == "m.facebook.com" ||
            host == "facebook.com" ||
            host.endsWith(".facebook.com") ||
            host == "appleid.apple.com"
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
