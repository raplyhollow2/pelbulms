package bt.pelbu.lms

import android.annotation.SuppressLint
import android.app.DownloadManager
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.view.View
import android.webkit.CookieManager
import android.webkit.URLUtil
import android.webkit.WebSettings
import android.webkit.WebView
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.browser.auth.AuthTabIntent
import androidx.browser.customtabs.CustomTabsIntent
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import androidx.lifecycle.lifecycleScope
import bt.pelbu.lms.databinding.ActivityMainBinding
import kotlinx.coroutines.launch
import org.json.JSONObject

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var chromeClient: PelbuWebChromeClient
    private lateinit var pelbuWebViewClient: PelbuWebViewClient
    private lateinit var googleSignInHelper: GoogleSignInHelper
    private var pendingStartUrl: String = BuildConfig.LMS_URL
    @Volatile private var pendingGoogleToken: String? = null
    private var lastOAuthUrl: String? = null

    val fileChooserLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult(),
    ) { result ->
        if (result.resultCode == RESULT_OK) {
            chromeClient.onFileChooserResult(result.data)
        } else {
            chromeClient.cancelFileChooser()
        }
    }

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) {
        startWebSession()
    }

    private val authTabLauncher = AuthTabIntent.registerActivityResultLauncher(this) { result ->
        handleAuthResult(result)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, true)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        pendingStartUrl = resolveLaunchUrl()
        googleSignInHelper = GoogleSignInHelper(this)
        configureWebView()
        binding.retryButton.setOnClickListener { reload() }
        binding.swipeRefresh.setColorSchemeResources(R.color.bhutan_orange, R.color.bhutan_yellow)
        binding.swipeRefresh.setOnRefreshListener { reload() }

        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    if (binding.webView.canGoBack()) {
                        binding.webView.goBack()
                    } else {
                        isEnabled = false
                        onBackPressedDispatcher.onBackPressed()
                    }
                }
            },
        )

        requestInstallPermissionsThenLoad()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        val url = resolveLaunchUrl()
        if (url != binding.webView.url) {
            binding.webView.loadUrl(url)
        }
    }

    override fun onResume() {
        super.onResume()
        binding.webView.onResume()
    }

    override fun onPause() {
        CookieManager.getInstance().flush()
        binding.webView.onPause()
        super.onPause()
    }

    override fun onDestroy() {
        binding.webView.destroy()
        super.onDestroy()
    }

    fun showOffline(offline: Boolean) {
        binding.offline.visibility = if (offline) View.VISIBLE else View.GONE
        binding.webView.visibility = if (offline) View.GONE else View.VISIBLE
        if (offline) setRefreshing(false)
    }

    fun setRefreshing(refreshing: Boolean) {
        binding.swipeRefresh.isRefreshing = refreshing
    }

    fun openExternalOrApp(uri: Uri) {
        if (!pelbuWebViewClient.handleUri(uri)) {
            binding.webView.loadUrl(uri.toString())
        }
    }

    /**
     * Google: native account picker (device Google accounts).
     * Facebook / Apple: Chrome Auth Tab with the user's Chrome session.
     */
    fun openOAuth(url: String) {
        lastOAuthUrl = url
        if (isGoogleAuthUrl(url)) {
            startNativeGoogleSignIn()
            return
        }
        openAuthTab(url)
    }

    fun startNativeGoogleSignIn() {
        lifecycleScope.launch {
            try {
                val idToken = googleSignInHelper.requestIdToken()
                completeGoogleSignIn(idToken)
            } catch (_: GetCredentialCancellationException) {
                // User closed the account picker.
            } catch (_: Exception) {
                val fallback = lastOAuthUrl
                if (!fallback.isNullOrBlank() && isGoogleAuthUrl(fallback)) {
                    Toast.makeText(this@MainActivity, R.string.google_signin_fallback, Toast.LENGTH_SHORT).show()
                    openAuthTab(fallback)
                } else {
                    Toast.makeText(this@MainActivity, R.string.google_signin_failed, Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    fun pendingGoogleIdToken(): String? = pendingGoogleToken

    private fun completeGoogleSignIn(idToken: String) {
        pendingGoogleToken = idToken
        val tokenJs = JSONObject.quote(idToken)
        val script = """
            (function() {
              var token = $tokenJs;
              if (typeof window.__pelbuCompleteNativeGoogle === 'function') {
                window.__pelbuCompleteNativeGoogle(token);
                return 'ok';
              }
              window.location.href = '/auth/native-google';
              return 'redirect';
            })();
        """.trimIndent()
        binding.webView.evaluateJavascript(script, null)
    }

    private fun openAuthTab(url: String) {
        val uri = Uri.parse(url)
        val redirectHost = currentLmsHost()
        try {
            val builder = AuthTabIntent.Builder()
            try {
                val method = builder.javaClass.getMethod(
                    "setEphemeralBrowsingEnabled",
                    Boolean::class.javaPrimitiveType,
                )
                method.invoke(builder, false)
            } catch (_: Exception) {
                // Older browser lib — skip.
            }
            builder.build().launch(
                authTabLauncher,
                uri,
                redirectHost,
                AUTH_CALLBACK_PATH,
            )
        } catch (_: Exception) {
            CustomTabsIntent.Builder()
                .setShowTitle(true)
                .setShareState(CustomTabsIntent.SHARE_STATE_OFF)
                .setShareIdentityEnabled(true)
                .build()
                .launchUrl(this, uri)
        }
    }

    private fun isGoogleAuthUrl(url: String): Boolean {
        val uri = Uri.parse(url)
        val host = uri.host.orEmpty()
        if (host == "accounts.google.com" || (host.endsWith(".google.com") && host.contains("accounts"))) {
            return true
        }
        val path = uri.path.orEmpty()
        if (host.endsWith(".supabase.co") && path.contains("/auth/v1/authorize")) {
            val provider = uri.getQueryParameter("provider").orEmpty()
            return provider == "google" || url.contains("provider=google")
        }
        return false
    }

    private fun currentLmsHost(): String {
        binding.webView.url?.let { Uri.parse(it).host }?.takeIf { it.isNotBlank() }?.let { return it }
        return Uri.parse(BuildConfig.LMS_URL).host ?: BuildConfig.LMS_HOST.removePrefix("www.")
    }

    private fun handleAuthResult(result: AuthTabIntent.AuthResult) {
        if (result.resultCode == AuthTabIntent.RESULT_OK) {
            val callback = result.resultUri ?: return
            binding.webView.loadUrl(callback.toString())
        }
    }

    private fun requestInstallPermissionsThenLoad() {
        val missing = AppPermissions.required.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (missing.isEmpty()) {
            startWebSession()
            return
        }
        permissionLauncher.launch(missing.toTypedArray())
    }

    private fun startWebSession() {
        showOffline(false)
        binding.webView.loadUrl(pendingStartUrl)
    }

    private fun reload() {
        showOffline(false)
        setRefreshing(true)
        if (binding.webView.url.isNullOrBlank()) {
            binding.webView.loadUrl(pendingStartUrl)
        } else {
            binding.webView.reload()
        }
    }

    private fun resolveLaunchUrl(): String {
        val data = intent?.data
        if (data != null && (data.scheme == "https" || data.scheme == "http")) {
            return data.toString()
        }
        return BuildConfig.LMS_URL
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebView() {
        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(binding.webView, true)
        }

        chromeClient = PelbuWebChromeClient(this)
        pelbuWebViewClient = PelbuWebViewClient(this)
        binding.webView.webViewClient = pelbuWebViewClient
        binding.webView.webChromeClient = chromeClient
        binding.webView.addJavascriptInterface(PelbuNativeAuthBridge(this), "PelbuNativeAuth")

        binding.webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            javaScriptCanOpenWindowsAutomatically = true
            setSupportMultipleWindows(true)
            mediaPlaybackRequiresUserGesture = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            allowFileAccess = false
            allowContentAccess = true
            loadsImagesAutomatically = true
            useWideViewPort = true
            loadWithOverviewMode = true
            builtInZoomControls = true
            displayZoomControls = false
            cacheMode = WebSettings.LOAD_DEFAULT
            userAgentString = "$userAgentString PelbuLMS/${BuildConfig.VERSION_NAME} AndroidNative"
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                safeBrowsingEnabled = true
            }
        }

        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)

        binding.webView.setDownloadListener { url, userAgent, contentDisposition, mimeType, _ ->
            enqueueDownload(url, userAgent, contentDisposition, mimeType)
        }
    }

    private fun enqueueDownload(
        url: String,
        userAgent: String,
        contentDisposition: String,
        mimeType: String,
    ) {
        val request = DownloadManager.Request(Uri.parse(url)).apply {
            setMimeType(mimeType)
            addRequestHeader("User-Agent", userAgent)
            val cookies = CookieManager.getInstance().getCookie(url)
            if (!cookies.isNullOrBlank()) {
                addRequestHeader("Cookie", cookies)
            }
            setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            setDestinationInExternalPublicDir(
                Environment.DIRECTORY_DOWNLOADS,
                URLUtil.guessFileName(url, contentDisposition, mimeType),
            )
            setTitle(getString(R.string.app_name))
        }
        val manager = getSystemService(DOWNLOAD_SERVICE) as DownloadManager
        manager.enqueue(request)
        Toast.makeText(this, R.string.download_started, Toast.LENGTH_SHORT).show()
    }

    companion object {
        private const val AUTH_CALLBACK_PATH = "/auth/callback"
    }
}
