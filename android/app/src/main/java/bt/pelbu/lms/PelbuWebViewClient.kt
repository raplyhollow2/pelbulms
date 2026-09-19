package bt.pelbu.lms

import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.browser.customtabs.CustomTabColorSchemeParams
import androidx.browser.customtabs.CustomTabsIntent
import androidx.core.content.ContextCompat

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

        if (isOAuthHost(uri.host)) {
            openCustomTab(uri)
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

    private fun isAllowedHost(host: String?): Boolean {
        if (host.isNullOrBlank()) return false
        val root = BuildConfig.LMS_HOST.removePrefix("www.")
        return host == root ||
            host == "www.$root" ||
            host.endsWith(".supabase.co") ||
            host.endsWith(".cloudinary.com")
    }

    private fun isOAuthHost(host: String?): Boolean {
        if (host.isNullOrBlank()) return false
        return host == "accounts.google.com" ||
            (host.endsWith(".google.com") && host.contains("accounts")) ||
            host == "www.facebook.com" ||
            host == "m.facebook.com" ||
            host == "facebook.com" ||
            host == "appleid.apple.com"
    }

    private fun openCustomTab(uri: Uri) {
        val color = ContextCompat.getColor(activity, R.color.bhutan_yellow)
        val scheme = CustomTabColorSchemeParams.Builder()
            .setToolbarColor(color)
            .build()
        val tabs = CustomTabsIntent.Builder()
            .setDefaultColorSchemeParams(scheme)
            .setShareState(CustomTabsIntent.SHARE_STATE_OFF)
            .setUrlBarHidingEnabled(true)
            .build()
        try {
            tabs.launchUrl(activity, uri)
        } catch (_: ActivityNotFoundException) {
            launchExternal(uri)
        }
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
