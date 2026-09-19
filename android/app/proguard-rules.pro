# Keep WebView / JS bridges used by the LMS session.
-keepclassmembers class android.webkit.** { *; }
-keepclassmembers class bt.pelbu.lms.** { *; }

-dontwarn android.webkit.**
