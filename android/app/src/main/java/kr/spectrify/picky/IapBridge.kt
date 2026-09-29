package kr.spectrify.picky

import android.app.Activity
import android.util.Log
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.PendingPurchasesParams
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.PurchasesUpdatedListener
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryPurchasesParams
import org.json.JSONArray
import org.json.JSONObject
import kotlin.coroutines.resume
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine

/**
 * 웹이 요청하는 Google Play 인앱결제를 처리한다.
 *
 * 앱 안에서 열리는 유료 템플릿은 외부 결제로 팔 수 없어(Play 결제 정책 4.1) 안드로이드
 * 앱에서는 토스 결제창 대신 Play Billing 을 쓴다. iOS 의
 * [IapBridge.swift](../../../../../../ios/Picky/Picky/IapBridge.swift) 와 같은 자리다.
 *
 * **네이티브가 맡는 것은 결제뿐이다** — 화면과 이용 기간 적립은 그대로 웹·서버의 몫이라,
 * 여기서는 구매 토큰을 꺼내 웹에 넘기기만 한다. (웹: app/src/lib/native-app.ts)
 *
 * ## 거래를 누가 닫는가 — iOS 와 다르다
 *
 * **서버가 닫는다.** Play 는 3일 안에 확인(acknowledge)하지 않은 구매를 자동 환불하는데,
 * 앱에 맡기면 그 사이 앱이 꺼지거나 지워졌을 때 돈만 돌아가고 기간은 남는 상태가 된다.
 * 그래서 서버가 이용 기간을 준 직후에 직접 소비(consume)한다
 * (server/src/memberships/google-iap.service.ts). 소비는 확인을 겸하고, 소모성 상품을
 * 다시 살 수 있게도 만든다.
 *
 * 그래서 웹의 `finish` 요청은 안드로이드에 오지 않는다. 와도 아무 일도 하지 않는다.
 *
 * ## 상품 유형
 *
 * **소모성 일회성 상품(consumable INAPP)** 이다. 기간제를 반복 구매해 이어 붙이는 판매
 * 방식이라 구독이 아니고, 소비하지 않으면 같은 상품을 다시 살 수 없다.
 */
class IapBridge(
    private val activity: Activity,
    private val scope: CoroutineScope,
    private val reply: (JSONObject) -> Unit,
) {
    /** 결제창이 떠 있는 동안 결과를 기다리는 요청. 한 번에 하나만 받는다. */
    private var pendingPurchase: ((List<Purchase>?, Int) -> Unit)? = null

    private val purchasesUpdated = PurchasesUpdatedListener { result, purchases ->
        pendingPurchase?.invoke(purchases, result.responseCode)
        pendingPurchase = null
    }

    private val billing: BillingClient = BillingClient.newBuilder(activity)
        .setListener(purchasesUpdated)
        // 후불 결제(보류 구매)를 받으려면 선언해야 한다. 선언하지 않으면 연결이 거절된다.
        .enablePendingPurchases(
            PendingPurchasesParams.newBuilder().enableOneTimeProducts().build(),
        )
        .build()

    /** 웹이 보낸 요청을 받는다. 답은 항상 같은 requestId 를 달아 이벤트로 돌려준다. */
    fun handle(message: JSONObject) {
        val requestId = message.optString("requestId")
        if (requestId.isEmpty()) return

        scope.launch {
            when (message.optString("action")) {
                "products" -> sendProducts(message.optJSONArray("productIds"), requestId)
                "purchase" -> buy(message.optString("productId"), requestId)
                "restore" -> sendUnfinished(requestId)
                // 거래를 닫는 것은 서버의 몫이다 (위 설명). 웹이 불러도 조용히 성공으로 답한다.
                "finish" -> answer(requestId) { put("ok", true) }
                else -> answer(requestId) { put("ok", false).put("reason", "failed") }
            }
        }
    }

    // MARK: - 상품

    /**
     * 가격은 Play 가 현지화한 문구(`formattedPrice`)를 그대로 넘긴다 —
     * 실제로 청구되는 값이라 우리 DB 가격보다 이쪽이 맞다.
     */
    private suspend fun sendProducts(ids: JSONArray?, requestId: String) {
        val productIds = ids.toStringList()
        if (productIds.isEmpty()) {
            answer(requestId) { put("products", JSONArray()) }
            return
        }

        val details = queryProducts(productIds)
        val payload = JSONArray()
        for (product in details) {
            val price = product.oneTimePurchaseOfferDetails?.formattedPrice ?: continue
            payload.put(JSONObject().put("productId", product.productId).put("displayPrice", price))
        }
        answer(requestId) { put("products", payload) }
    }

    private suspend fun queryProducts(productIds: List<String>): List<ProductDetails> {
        if (!connect()) return emptyList()

        val params = QueryProductDetailsParams.newBuilder()
            .setProductList(
                productIds.map {
                    QueryProductDetailsParams.Product.newBuilder()
                        .setProductId(it)
                        .setProductType(BillingClient.ProductType.INAPP)
                        .build()
                },
            )
            .build()

        return suspendCancellableCoroutine { cont ->
            billing.queryProductDetailsAsync(params) { result, details ->
                if (result.responseCode != BillingClient.BillingResponseCode.OK) {
                    Log.w(TAG, "상품 조회 실패: ${result.debugMessage}")
                    cont.resume(emptyList())
                } else {
                    cont.resume(details.productDetailsList)
                }
            }
        }
    }

    // MARK: - 결제

    private suspend fun buy(productId: String?, requestId: String) {
        if (productId.isNullOrEmpty()) {
            answer(requestId) { put("ok", false).put("reason", "failed") }
            return
        }

        // 상품을 못 찾는 경우가 실제로 많다 — Play Console 등록 직후이거나, 앱이 아직
        // 테스트 트랙에 올라가지 않았을 때다 (Play 는 스토어에 올라간 빌드에만 상품을 준다).
        val product = queryProducts(listOf(productId)).firstOrNull()
        if (product == null) {
            answer(requestId) { put("ok", false).put("reason", "unavailable") }
            return
        }

        val flow = BillingFlowParams.newBuilder()
            .setProductDetailsParamsList(
                listOf(
                    BillingFlowParams.ProductDetailsParams.newBuilder()
                        .setProductDetails(product)
                        .build(),
                ),
            )
            .build()

        val (purchases, code) = suspendCancellableCoroutine { cont ->
            pendingPurchase = { list, responseCode -> cont.resume(list to responseCode) }
            val launched = billing.launchBillingFlow(activity, flow)
            if (launched.responseCode != BillingClient.BillingResponseCode.OK) {
                pendingPurchase = null
                cont.resume(null to launched.responseCode)
            }
        }

        when (code) {
            BillingClient.BillingResponseCode.USER_CANCELED ->
                return answer(requestId) { put("ok", false).put("reason", "cancelled") }
            BillingClient.BillingResponseCode.ITEM_UNAVAILABLE ->
                return answer(requestId) { put("ok", false).put("reason", "unavailable") }
            BillingClient.BillingResponseCode.OK -> Unit
            else -> {
                Log.w(TAG, "결제 실패 (code=$code)")
                return answer(requestId) { put("ok", false).put("reason", "failed") }
            }
        }

        val purchase = purchases?.firstOrNull { it.products.contains(productId) }
        if (purchase == null) {
            answer(requestId) { put("ok", false).put("reason", "failed") }
            return
        }

        // 후불 결제는 승인될 때까지 PENDING 이다. 기간을 주면 안 되고, 승인되면
        // 다음에 화면에 들어올 때 restore 가 꺼내 간다.
        if (purchase.purchaseState == Purchase.PurchaseState.PENDING) {
            answer(requestId) { put("ok", false).put("reason", "pending") }
            return
        }

        answer(requestId) { putReceipt(purchase, productId) }
    }

    // MARK: - 복원

    /**
     * 아직 소비되지 않은 구매를 모두 넘긴다.
     *
     * 적립 요청이 실패했거나 그 사이 앱이 꺼진 경우를 위한 복구 경로다 — 돈은 빠져나갔는데
     * 이용 기간이 없는 상태로 남지 않게, 결제 화면에 들어올 때마다 확인한다.
     * 서버가 소비한 구매는 여기 나오지 않으므로 자연히 걸러진다.
     */
    private suspend fun sendUnfinished(requestId: String) {
        if (!connect()) {
            answer(requestId) { put("receipts", JSONArray()) }
            return
        }

        val params = QueryPurchasesParams.newBuilder()
            .setProductType(BillingClient.ProductType.INAPP)
            .build()

        val purchases: List<Purchase> = suspendCancellableCoroutine { cont ->
            billing.queryPurchasesAsync(params) { result, list ->
                if (result.responseCode != BillingClient.BillingResponseCode.OK) {
                    cont.resume(emptyList())
                } else {
                    cont.resume(list)
                }
            }
        }

        val receipts = JSONArray()
        for (purchase in purchases) {
            if (purchase.purchaseState != Purchase.PurchaseState.PURCHASED) continue
            val productId = purchase.products.firstOrNull() ?: continue
            receipts.put(JSONObject().putReceipt(purchase, productId))
        }
        answer(requestId) { put("receipts", receipts) }
    }

    // MARK: - 연결

    /** 필요할 때 연결한다. 이미 연결돼 있으면 곧바로 true. */
    private suspend fun connect(): Boolean {
        if (billing.isReady) return true

        return suspendCancellableCoroutine { cont ->
            billing.startConnection(object : BillingClientStateListener {
                private var resumed = false

                override fun onBillingSetupFinished(result: BillingResult) {
                    if (resumed) return
                    resumed = true
                    val ok = result.responseCode == BillingClient.BillingResponseCode.OK
                    if (!ok) Log.w(TAG, "Play Billing 연결 실패: ${result.debugMessage}")
                    cont.resume(ok)
                }

                override fun onBillingServiceDisconnected() {
                    // 끊김은 여기서 알린다. 다음 요청이 다시 연결한다.
                    if (resumed) return
                    resumed = true
                    cont.resume(false)
                }
            })
        }
    }

    // MARK: - 응답

    /**
     * 웹이 기다리는 모양으로 영수증을 담는다.
     *
     * iOS 는 `signedTransactionInfo` 에 서명 영수증(JWS)을 넣지만, Play 에는 그런 것이 없고
     * **서버가 토큰으로 구글에 직접 조회한다.** 그래서 두 자리에 같은 토큰을 넣고 상품 ID 를
     * 함께 준다 — 조회에 상품 ID 가 필요하다.
     */
    private fun JSONObject.putReceipt(purchase: Purchase, productId: String): JSONObject =
        put("ok", true)
            .put("transactionId", purchase.purchaseToken)
            .put("signedTransactionInfo", purchase.purchaseToken)
            .put("productId", productId)

    private fun answer(requestId: String, build: JSONObject.() -> JSONObject) {
        reply(JSONObject().apply { build() }.put("requestId", requestId))
    }

    companion object {
        private const val TAG = "PickyIap"

        /** 웹이 이 이름으로 요청을 보낸다 (NativeBridge 의 shim). */
        const val HANDLER_NAME = "iap"

        /** 답을 돌려주는 이벤트 — iOS 와 같은 이름이어야 한다. */
        const val RESULT_EVENT = "picky:iap-result"
    }
}

private fun JSONArray?.toStringList(): List<String> {
    if (this == null) return emptyList()
    return (0 until length()).mapNotNull { optString(it).takeIf(String::isNotEmpty) }
}
