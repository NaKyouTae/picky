import java.io.File

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

/**
 * 기기의 `localhost:<port>` 를 맥의 같은 포트로 되돌린다 (`adb reverse`).
 *
 * **기기가 재연결될 때마다 풀린다.** 안 걸린 채로 앱을 띄우면 로컬 개발 서버에 못 닿아
 * 까만 화면만 뜨고 에러도 나지 않는다 — 원인을 찾기 어려운 실패라 빌드에 붙여 둔다.
 * Android Studio 의 Run 도 assembleDebug 를 거치므로 같이 걸린다.
 *
 * ⚠️ 빌드 스크립트에서는 `java` · `android` 가 플러그인 확장 이름으로 선점돼 있어
 * `java.io.File` / `android.sdkDirectory` 같은 표기가 엉뚱한 곳으로 붙는다.
 * 그래서 파일 위쪽의 `import` 로 끌어오고, SDK 경로는 local.properties 에서 읽는다.
 */

// 로컬 개발 서버를 볼 때만 필요하다. 운영 URL 을 보는 빌드에는 걸지 않는다.
val localPort = Regex("""^https?://(?:localhost|127\.0\.0\.1):(\d+)""")
    .find(debugWebUrl)?.groupValues?.get(1)?.toIntOrNull()

localPort?.let { port ->
    // Android Studio 가 local.properties 에 항상 써 주는 값이 가장 믿을 만하다.
    val sdkDir = providers.environmentVariable("ANDROID_HOME")
        .orElse(providers.environmentVariable("ANDROID_SDK_ROOT"))
        .orNull
        ?: rootProject.file("local.properties")
            .takeIf { it.exists() }
            ?.readLines()
            ?.firstOrNull { it.startsWith("sdk.dir=") }
            ?.substringAfter("=")
        ?: return@let

    val adb = File(sdkDir, "platform-tools/adb").absolutePath

    val adbReverse = tasks.register("adbReverse") {
        description = "기기의 localhost:$port 를 맥의 개발 서버로 되돌린다"
        // 매번 돌아야 한다 — 기기 연결 상태는 Gradle 이 알 수 없다.
        outputs.upToDateWhen { false }
        doLast {
            if (!File(adb).exists()) {
                logger.lifecycle("adb 를 찾지 못해 포트 되돌리기를 건너뛴다: $adb")
                return@doLast
            }
            val devices = ProcessBuilder(adb, "devices")
                .redirectErrorStream(true).start()
                .inputStream.bufferedReader().readLines()
                .drop(1)
                .mapNotNull { line -> line.substringBefore('\t').trim().takeIf { it.isNotEmpty() } }

            if (devices.isEmpty()) {
                logger.lifecycle("연결된 기기가 없어 포트 되돌리기를 건너뛴다")
                return@doLast
            }
            devices.forEach { serial ->
                ProcessBuilder(adb, "-s", serial, "reverse", "tcp:$port", "tcp:$port")
                    .redirectErrorStream(true).start().waitFor()
                logger.lifecycle("adb reverse tcp:$port → $serial")
            }
        }
    }

    tasks.matching { it.name == "assembleDebug" || it.name == "installDebug" }
        .configureEach { finalizedBy(adbReverse) }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.appcompat)
    implementation(libs.androidx.activity.ktx)
    implementation(libs.androidx.webkit)
    implementation(libs.androidx.core.splashscreen)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.kotlinx.coroutines.android)
    implementation(libs.billing.ktx)
}
