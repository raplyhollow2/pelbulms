package bt.pelbu.lms

import android.Manifest
import android.os.Build

object AppPermissions {
    val required: Array<String>
        get() {
            val list = mutableListOf(
                Manifest.permission.CAMERA,
                Manifest.permission.RECORD_AUDIO,
            )
            if (Build.VERSION.SDK_INT >= 33) {
                list += Manifest.permission.POST_NOTIFICATIONS
                list += Manifest.permission.READ_MEDIA_IMAGES
                list += Manifest.permission.READ_MEDIA_VIDEO
            } else {
                list += Manifest.permission.READ_EXTERNAL_STORAGE
            }
            return list.toTypedArray()
        }
}
