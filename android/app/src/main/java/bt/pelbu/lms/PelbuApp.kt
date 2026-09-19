package bt.pelbu.lms

import android.app.Application
import android.webkit.WebView

class PelbuApp : Application() {
    override fun onCreate() {
        super.onCreate()
        if (BuildConfig.DEBUG) {
            WebView.setWebContentsDebuggingEnabled(true)
        }
    }
}
