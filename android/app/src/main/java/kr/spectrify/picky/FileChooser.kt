package kr.spectrify.picky

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.util.Log
import android.webkit.ValueCallback
import android.webkit.WebChromeClient.FileChooserParams
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.FileProvider
import java.io.File

/**
 * 웹의 `<input type="file">` 을 연다.
 *
 * **안드로이드 WebView 는 파일 입력을 스스로 처리하지 않는다.** `onShowFileChooser` 를
 * 구현하지 않으면 입력을 눌러도 예외도 로그도 없이 **아무 일이 일어나지 않는다** —
 * 웹만 보고 있으면 원인을 찾을 수 없는 실패다. 이 앱에서 막히는 곳은 세 군데다.
 *
 * - 챌린지 인증 사진 — 카메라 (`capture="environment"`) · 사진첩
 *   (app/src/components/challenge-group-screen.tsx)
 * - 문의 첨부 — 여러 장 (app/src/components/inquiry-form.tsx)
 *
 * ## 권한
 *
 * **런타임 권한을 하나도 쓰지 않는다.** 사진첩은 `ACTION_GET_CONTENT`(안드로이드 13+ 에서는
 * 시스템 사진 선택기로 연결된다)라 권한이 필요 없고, 촬영은 카메라 앱에 맡기는
 * `ACTION_IMAGE_CAPTURE` 라 **매니페스트에 `CAMERA` 를 선언하지 않는 한** 권한이 필요 없다.
 * 선언해 버리면 그 순간부터 런타임 승인을 받아야 하므로 일부러 넣지 않았다.
 *
 * ## 콜백은 반드시 한 번 불러야 한다
 *
 * `ValueCallback` 을 부르지 않고 흘리면 그 `<input>` 은 **영영 다시 열리지 않는다.**
 * 취소도 결과이므로 `null` 로 답한다.
 */
class FileChooser(private val activity: ComponentActivity) {

    private companion object { const val TAG = "PickyFileChooser" }

    private var pending: ValueCallback<Array<Uri>>? = null

    /** 카메라가 사진을 쓸 자리. 촬영이 끝나면 이 주소를 웹에 넘긴다. */
    private var cameraOutput: Uri? = null

    private val pickContent = activity.registerForActivityResult(
        ActivityResultContracts.StartActivityForResult(),
    ) { result ->
        deliver(parseResult(result.resultCode, result.data))
    }

    private val takePicture = activity.registerForActivityResult(
        ActivityResultContracts.TakePicture(),
    ) { saved ->
        deliver(if (saved) cameraOutput?.let { arrayOf(it) } else null)
    }

    /** WebChromeClient.onShowFileChooser 에서 부른다. */
    fun open(params: FileChooserParams, callback: ValueCallback<Array<Uri>>) {
        // 앞선 요청이 남아 있으면 먼저 닫는다 — 두 개를 동시에 들고 있을 수 없다.
        pending?.onReceiveValue(null)
        pending = callback

        // capture 속성이 붙은 입력은 사진첩을 거치지 않고 카메라가 바로 떠야 한다.
        if (params.isCaptureEnabled && launchCamera()) return

        try {
            pickContent.launch(params.createIntent())
        } catch (e: ActivityNotFoundException) {
            deliver(null)
        }
    }

    /** 카메라 앱을 띄운다. 띄우지 못하면 false — 호출한 쪽이 사진첩으로 돌아간다. */
    private fun launchCamera(): Boolean {
        val target = createCameraFile() ?: return false
        return try {
            cameraOutput = target
            takePicture.launch(target)
            true
        } catch (e: ActivityNotFoundException) {
            // 카메라 앱이 없는 기기·에뮬레이터
            cameraOutput = null
            false
        }
    }

    /**
     * 촬영본을 담을 빈 파일. 캐시에 두므로 따로 지우지 않아도 시스템이 회수한다.
     *
     * 카메라 앱에 넘기려면 `file://` 이 아니라 FileProvider 의 `content://` 여야 한다
     * (API 24+ 는 `file://` 을 넘기면 FileUriExposedException 으로 죽는다).
     */
    private fun createCameraFile(): Uri? = try {
        val dir = File(activity.cacheDir, "camera").apply { mkdirs() }
        val file = File.createTempFile("capture_", ".jpg", dir)
        FileProvider.getUriForFile(activity, "${activity.packageName}.fileprovider", file)
    } catch (e: Exception) {
        null
    }

    /**
     * 선택 결과에서 주소를 꺼낸다.
     *
     * ⚠️ **`FileChooserParams.parseResult` 를 쓰면 안 된다.** AOSP 구현이 `intent.getData()`
     * 하나만 보고 `ClipData` 는 아예 읽지 않는다. 여러 장을 고를 수 있게 띄우면
     * (`<input multiple>` → `MODE_OPEN_MULTIPLE`) 결과가 **항상 ClipData 로 오기 때문에**
     * 그 함수는 늘 null 을 돌려주고, 웹은 빈 `files` 를 받아 조용히 아무 일도 하지 않는다.
     * 사진은 분명히 골랐는데 화면이 그대로인 실패라 원인을 찾기 어렵다.
     */
    private fun parseResult(resultCode: Int, data: Intent?): Array<Uri>? {
        if (resultCode != Activity.RESULT_OK || data == null) return null

        data.clipData?.let { clip ->
            val uris = (0 until clip.itemCount).mapNotNull { clip.getItemAt(it).uri }
            if (uris.isNotEmpty()) return uris.toTypedArray()
        }
        return data.data?.let { arrayOf(it) }
    }

    private fun deliver(uris: Array<Uri>?) {
        Log.i(TAG, "고른 파일 ${uris?.size ?: 0}개")
        pending?.onReceiveValue(uris)
        pending = null
        cameraOutput = null
    }
}
