# Keep WebView / JS bridges used by the LMS session.
-keepclassmembers class android.webkit.** { *; }
-keepclassmembers class bt.pelbu.lms.** { *; }
-keep class bt.pelbu.lms.PelbuNativeAuthBridge { *; }
-keep class com.google.android.libraries.identity.googleid.** { *; }
-keep class androidx.credentials.** { *; }

-dontwarn android.webkit.**
