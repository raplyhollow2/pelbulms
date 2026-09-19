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
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import bt.pelbu.lms.databinding.ActivityMainBinding

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var chromeClient: PelbuWebChromeClient
    private lateinit var pelbuWebViewClient: PelbuWebViewClient
    private var pendingStartUrl: String = BuildConfig.LMS_URL

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

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, true)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        pendingStartUrl = resolveLaunchUrl()
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
}
