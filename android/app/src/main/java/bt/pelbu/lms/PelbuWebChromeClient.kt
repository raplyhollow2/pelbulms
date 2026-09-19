package bt.pelbu.lms

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Environment
import android.os.Message
import android.provider.MediaStore
import android.webkit.ConsoleMessage
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.core.content.FileProvider
import java.io.File

class PelbuWebChromeClient(
    private val activity: MainActivity,
) : WebChromeClient() {

    var filePathCallback: ValueCallback<Array<Uri>>? = null
        private set
    private var cameraUri: Uri? = null

    override fun onPermissionRequest(request: PermissionRequest) {
        request.grant(request.resources)
    }

    override fun onCreateWindow(
        view: WebView,
        isDialog: Boolean,
        isUserGesture: Boolean,
        resultMsg: Message,
    ): Boolean {
        val transport = resultMsg.obj as WebView.WebViewTransport
        val popup = WebView(view.context)
        popup.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(
                v: WebView,
                request: android.webkit.WebResourceRequest,
            ): Boolean {
                // Prefer main WebView so OAuth PKCE cookies stay in one jar.
                activity.openExternalOrApp(request.url)
                return true
            }
        }
        transport.webView = popup
        resultMsg.sendToTarget()
        return true
    }

    override fun onShowFileChooser(
        webView: WebView,
        filePathCallback: ValueCallback<Array<Uri>>,
        fileChooserParams: FileChooserParams,
    ): Boolean {
        this.filePathCallback?.onReceiveValue(null)
        this.filePathCallback = filePathCallback

        val takePicture = Intent(MediaStore.ACTION_IMAGE_CAPTURE)
        cameraUri = createImageUri()
        cameraUri?.let { uri ->
            takePicture.putExtra(MediaStore.EXTRA_OUTPUT, uri)
            takePicture.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }

        val content = fileChooserParams.createIntent()
        val chooser = Intent(Intent.ACTION_CHOOSER).apply {
            putExtra(Intent.EXTRA_INTENT, content)
            putExtra(Intent.EXTRA_TITLE, activity.getString(R.string.choose_file))
            putExtra(Intent.EXTRA_INITIAL_INTENTS, arrayOf(takePicture))
        }

        return try {
            activity.fileChooserLauncher.launch(chooser)
            true
        } catch (_: ActivityNotFoundException) {
            this.filePathCallback = null
            false
        }
    }

    override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
        return !BuildConfig.DEBUG
    }

    fun onFileChooserResult(data: Intent?) {
        val fromCamera = cameraUri
        val fromPicker = WebChromeClient.FileChooserParams.parseResult(Activity.RESULT_OK, data)
        val result = when {
            data == null && fromCamera != null -> arrayOf(fromCamera)
            fromPicker != null -> fromPicker
            fromCamera != null -> arrayOf(fromCamera)
            else -> null
        }
        filePathCallback?.onReceiveValue(result)
        filePathCallback = null
        cameraUri = null
    }

    fun cancelFileChooser() {
        filePathCallback?.onReceiveValue(null)
        filePathCallback = null
        cameraUri = null
    }

    private fun createImageUri(): Uri? {
        val dir = activity.getExternalFilesDir(Environment.DIRECTORY_PICTURES) ?: return null
        val file = File(dir, "kyc_${System.currentTimeMillis()}.jpg")
        return FileProvider.getUriForFile(
            activity,
            "${activity.packageName}.fileprovider",
            file,
        )
    }
}
