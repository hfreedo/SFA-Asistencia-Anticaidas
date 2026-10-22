plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}
if (file("google-services.json").exists()) apply(plugin = "com.google.gms.google-services")
val releaseEnvironment = listOf(
    "SFA_ANDROID_KEYSTORE", "SFA_ANDROID_KEY_ALIAS",
    "SFA_ANDROID_STORE_PASSWORD", "SFA_ANDROID_KEY_PASSWORD"
).associateWith { providers.environmentVariable(it).orNull }

val validateReleaseSigning = tasks.register("validateReleaseSigning") {
    doLast {
        val missing = releaseEnvironment.filterValues { it.isNullOrBlank() }.keys
        check(missing.isEmpty()) { "Release signing missing: ${missing.joinToString()}. See docs/ANDROID_RELEASE.md" }
        val keyFile = file(releaseEnvironment.getValue("SFA_ANDROID_KEYSTORE")!!)
        check(keyFile.isFile) { "Release keystore not found" }
        check(!keyFile.name.equals("debug.keystore", ignoreCase = true) &&
            !releaseEnvironment.getValue("SFA_ANDROID_KEY_ALIAS").equals("androiddebugkey", ignoreCase = true)) {
            "A debug key cannot be used for distribution"
        }
        check(file("google-services.json").isFile) { "Firebase Android configuration is required for this release" }
    }
}
android {
    namespace = "org.sfa.asistencia"
    compileSdk = 35
    defaultConfig {
        applicationId = "org.sfa.asistencia"
        minSdk = 31
        targetSdk = 35
        versionCode = 10
        versionName = "0.7.0-release"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }
    buildFeatures { compose = true }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    signingConfigs {
        create("distribution") {
            releaseEnvironment["SFA_ANDROID_KEYSTORE"]?.let { storeFile = file(it) }
            storePassword = releaseEnvironment["SFA_ANDROID_STORE_PASSWORD"]
            keyAlias = releaseEnvironment["SFA_ANDROID_KEY_ALIAS"]
            keyPassword = releaseEnvironment["SFA_ANDROID_KEY_PASSWORD"]
        }
    }
    buildTypes {
        release {
            isDebuggable = false
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("distribution")
        }
    }
}

tasks.matching { it.name == "preReleaseBuild" }.configureEach {
    dependsOn(validateReleaseSigning)
}
dependencies {
    implementation(platform("com.google.firebase:firebase-bom:33.7.0"))
    implementation("com.google.firebase:firebase-messaging")
    implementation(platform("androidx.compose:compose-bom:2024.12.01"))
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
    implementation("com.journeyapps:zxing-android-embedded:4.3.0")
    testImplementation("junit:junit:4.13.2")
}
