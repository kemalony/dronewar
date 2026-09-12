plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "dev.dronewar.game"
    compileSdk = 34
    defaultConfig {
        applicationId = "dev.dronewar.game"
        minSdk = 24
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"
    }
    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            signingConfig = signingConfigs.getByName("debug")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

// :core-sim brings :rules with it (`api`), so gameplay constants and player physics
// arrive from their single owners. :bench-core is here only for `Metrics`, so AC-5 is
// measured on exactly the code path ADR-001 was decided on.
dependencies {
    implementation(project(":core-sim"))
    implementation(project(":bench-core"))
}
