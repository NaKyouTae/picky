plugins {
    // AGP 9 부터 Kotlin 지원이 내장이다. org.jetbrains.kotlin.android 를 따로 붙이면
    // "no longer required" 로 빌드가 멈춘다.
    alias(libs.plugins.android.application)
}

/**
 * Debug 빌드가 띄울 웹 주소.
 *
 * **기기의 localhost 는 기기 자신이다.** 맥의 21001(`pnpm dev:app`)에 닿으려면 먼저
 * adb 로 포트를 되돌려 줘야 한다 — 에뮬레이터·USB 실기기 모두 같은 명령이 통한다.
 *
 *   adb reverse tcp:21001 tcp:21001
 *
 * (`10.0.2.2` 는 에뮬레이터 전용 우회 주소인데 이 환경에서는 닿지 않았다. adb reverse 가
 *  실기기까지 같은 방식으로 덮으므로 이쪽을 기본으로 둔다.)
 *
 * 다른 주소를 보려면 빌드할 때 넘긴다:
 *   ./gradlew installDebug -PpickyWebUrl=https://picky.spectrify.kr
 *
 * Release 는 이 값을 보지 않는다 — 개발용 주소가 실린 빌드가 올라가는 사고를 막는다.
 */
val debugWebUrl = (project.findProperty("pickyWebUrl") as String?) ?: "http://localhost:21001"

android {
    namespace = "kr.spectrify.picky"
    compileSdk = 37

    defaultConfig {
        // iOS Bundle ID 와 같은 값. Play Console 에 한 번 올라가면 바꿀 수 없다.
        applicationId = "kr.spectrify.picky"
        minSdk = 26
        targetSdk = 37
        versionCode = 1
        versionName = "1.0.0"
    }

    buildFeatures {
        // AGP 8 부터 BuildConfig 생성이 기본 꺼짐이다. AppConfig 가 BuildConfig.DEBUG 를 본다.
        buildConfig = true
    }

    buildTypes {
        debug {
            buildConfigField("String", "WEB_URL", "\"$debugWebUrl\"")
        }
        release {
            buildConfigField("String", "WEB_URL", "\"https://picky.spectrify.kr\"")
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.appcompat)
    implementation(libs.androidx.activity.ktx)
    implementation(libs.androidx.webkit)
    implementation(libs.androidx.core.splashscreen)
}
