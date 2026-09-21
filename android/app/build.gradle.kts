import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val keystorePropertiesFile = rootProject.file("keystore.properties")
val keystoreProperties = Properties()
if (keystorePropertiesFile.exists()) {
    keystorePropertiesFile.inputStream().use { keystoreProperties.load(it) }
}

val versionPropertiesFile = rootProject.file("version.properties")
val versionProperties = Properties()
if (versionPropertiesFile.exists()) {
    versionPropertiesFile.inputStream().use { versionProperties.load(it) }
}

fun resolveVersionName(): String {
    val fromProp = project.findProperty("VERSION_NAME") as String?
    if (!fromProp.isNullOrBlank()) return fromProp
    return versionProperties.getProperty("VERSION_NAME") ?: "1.0.0"
}

fun resolveVersionCode(): Int {
    val fromProp = (project.findProperty("VERSION_CODE") as String?)?.toIntOrNull()
    if (fromProp != null) return fromProp
    return versionProperties.getProperty("VERSION_CODE")?.toIntOrNull() ?: 1
}

android {
    namespace = "bt.pelbu.lms"
    compileSdk = 36

    defaultConfig {
        applicationId = "bt.pelbu.lms"
        minSdk = 24
        targetSdk = 36
        versionCode = resolveVersionCode()
        versionName = resolveVersionName()

        buildConfigField("String", "LMS_URL", "\"${project.findProperty("LMS_URL") ?: "https://pelbulms.vercel.app"}\"")
        buildConfigField("String", "LMS_HOST", "\"${project.findProperty("LMS_HOST") ?: "pelbulms.vercel.app"}\"")
        // Web OAuth client ID from Google Cloud (same one Supabase Google provider uses).
        buildConfigField(
            "String",
            "GOOGLE_WEB_CLIENT_ID",
            "\"${project.findProperty("GOOGLE_WEB_CLIENT_ID") ?: "705976534657-5gqratv5rqnam8v2qdhvepoaea79dhus.apps.googleusercontent.com"}\"",
        )
        buildConfigField("String", "VERSION_NAME_DISPLAY", "\"$versionName\"")
        buildConfigField("int", "VERSION_CODE_DISPLAY", "$versionCode")
    }

    signingConfigs {
        if (keystorePropertiesFile.exists()) {
            create("release") {
                keyAlias = keystoreProperties.getProperty("keyAlias")
                keyPassword = keystoreProperties.getProperty("keyPassword")
                storeFile = rootProject.file(keystoreProperties.getProperty("storeFile"))
                storePassword = keystoreProperties.getProperty("storePassword")
            }
        }
    }

    buildTypes {
        debug {
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
            isMinifyEnabled = false
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
            val releaseSigning = signingConfigs.findByName("release")
            if (releaseSigning != null) {
                signingConfig = releaseSigning
            }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        buildConfig = true
        viewBinding = true
    }
    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.activity:activity-ktx:1.10.1")
    implementation("androidx.webkit:webkit:1.12.1")
    implementation("androidx.browser:browser:1.9.0")
    implementation("androidx.credentials:credentials:1.5.0")
    implementation("androidx.credentials:credentials-play-services-auth:1.5.0")
    implementation("com.google.android.libraries.identity.googleid:googleid:1.1.1")
    implementation("androidx.swiperefreshlayout:swiperefreshlayout:1.1.0")
    implementation("com.google.android.material:material:1.12.0")
}
