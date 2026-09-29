package kr.spectrify.picky

import android.Manifest
import android.content.ContentValues
import android.content.pm.PackageManager
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import java.util.concurrent.Executors

/**
 * 웹이 넘긴 이미지를 갤러리에 담는다 (콜라주 저장).
 *
 * **왜 네이티브가 맡는가.** 웹의 저장 경로는 `<a download>` 에 `blob:` 주소를 다는 방식인데
 * (app/src/lib/save-image.ts), WebView 에서는 이게 아무 일도 하지 않는다. `DownloadListener`
 * 를 달아도 소용없다 — DownloadManager 는 `blob:` 스킴을 받지 못한다. iOS 가 PHPhotoLibrary 로
 * 우회한 것과 같은 이유로, 여기서는 MediaStore 로 받는다.
 *
 * ## 권한
 *
 * **Android 10(API 29)부터는 권한이 필요 없다.** MediaStore 에 자기가 만든 항목을 넣는 것은
 * 앱 권한 밖의 일이기 때문이다. 9 이하만 `WRITE_EXTERNAL_STORAGE` 가 필요해서
 * 매니페스트에 `maxSdkVersion="28"` 로 제한해 선언하고, 저장할 때 한 번 묻는다.
 */
class ImageSaver(private val activity: ComponentActivity) {

    /** 권한 답을 기다리는 저장 요청. 한 번에 하나만 받는다. */
    private var awaitingPermission: (() -> Unit)? = null

    private val requestWrite = activity.registerForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        val pending = awaitingPermission
        awaitingPermission = null
        if (granted) pending?.invoke() else onResult?.invoke(Result.DENIED)
    }

    /** 저장 결과를 받을 쪽 (NativeBridge 가 웹에 이벤트로 넘긴다). */
    var onResult: ((Result) -> Unit)? = null

    enum class Result { OK, DENIED, FAILED }

    /** 디코딩·파일 쓰기는 메인 스레드에서 하면 안 된다 — 한 장이 수 MB 다. */
    private val io = Executors.newSingleThreadExecutor()

    /** `data:image/png;base64,...` 를 받아 갤러리에 담는다. */
    fun save(dataUrl: String) {
        if (needsLegacyPermission()) {
            awaitingPermission = { io.execute { write(dataUrl) } }
            requestWrite.launch(Manifest.permission.WRITE_EXTERNAL_STORAGE)
            return
        }
        io.execute { write(dataUrl) }
    }

    private fun needsLegacyPermission(): Boolean {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) return false
        return ContextCompat.checkSelfPermission(activity, Manifest.permission.WRITE_EXTERNAL_STORAGE) !=
            PackageManager.PERMISSION_GRANTED
    }

    private fun write(dataUrl: String) {
        val comma = dataUrl.indexOf(',')
        if (!dataUrl.startsWith("data:image/") || comma < 0) {
            onResult?.invoke(Result.FAILED)
            return
        }
        val mime = dataUrl.substring(5, dataUrl.indexOf(';').takeIf { it in 0..comma } ?: comma)
        val bytes = try {
            Base64.decode(dataUrl.substring(comma + 1), Base64.DEFAULT)
        } catch (e: IllegalArgumentException) {
            onResult?.invoke(Result.FAILED)
            return
        }

        val resolver = activity.contentResolver
        val values = ContentValues().apply {
            put(MediaStore.Images.Media.DISPLAY_NAME, "picky_${System.currentTimeMillis()}")
            put(MediaStore.Images.Media.MIME_TYPE, mime)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                put(MediaStore.Images.Media.RELATIVE_PATH, "${Environment.DIRECTORY_PICTURES}/Picky")
                // 다 쓰기 전에는 갤러리에 보이지 않게 한다 — 깨진 썸네일이 잠깐 뜨는 것을 막는다.
                put(MediaStore.Images.Media.IS_PENDING, 1)
            }
        }

        val uri = try {
            resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values)
        } catch (e: Exception) {
            null
        }
        if (uri == null) {
            onResult?.invoke(Result.FAILED)
            return
        }

        try {
            resolver.openOutputStream(uri)?.use { it.write(bytes) } ?: error("스트림 없음")
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                resolver.update(uri, ContentValues().apply {
                    put(MediaStore.Images.Media.IS_PENDING, 0)
                }, null, null)
            }
            onResult?.invoke(Result.OK)
        } catch (e: Exception) {
            resolver.delete(uri, null, null)
            onResult?.invoke(Result.FAILED)
        }
    }
}
