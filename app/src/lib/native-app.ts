'use client';

import { useSyncExternalStore } from 'react';

/**
 * iOS 네이티브 앱(WKWebView) 안에서 열렸는지, 그리고 네이티브에만 있는 기능을 부른다.
 *
 * 앱은 WKWebView 에 메시지 핸들러를 심어 두므로(ios/Picky/Picky/WebView.swift)
 * 그 존재로 앱 여부를 가른다. 일반 모바일 브라우저에서는 전부 false / no-op 이다.
 */

type NativeBridgeWindow = Window & {
  webkit?: { messageHandlers?: Record<string, { postMessage(body: unknown): void }> };
};

function handlers() {
  if (typeof window === 'undefined') return undefined;
  return (window as NativeBridgeWindow).webkit?.messageHandlers;
}

export function isNativeApp(): boolean {
  return Boolean(handlers()?.saveImage);
}

// 브리지는 문서가 뜰 때 주입되고 이후 바뀌지 않으므로 구독할 대상이 없다.
const subscribe = () => () => {};
// 서버에서는 판별할 수 없다. 하이드레이션 불일치를 피하려고 false 로 맞춘다.
const getServerSnapshot = () => false;

/** 네이티브 앱 여부 훅. */
export function useIsNativeApp(): boolean {
  return useSyncExternalStore(subscribe, isNativeApp, getServerSnapshot);
}

/** 네이티브 저장 결과 — WebView.swift 가 같은 이름의 이벤트로 돌려준다. */
export type SaveImageResult = { ok: true } | { ok: false; reason: 'denied' | 'failed' };

const SAVE_IMAGE_EVENT = 'picky:save-image-result';

/**
 * 사진 앱에 이미지를 저장한다 (네이티브 앱 전용).
 *
 * WKWebView 는 `<a download>` 를 무시해서 웹 방식 저장이 아무 일도 하지 않는다.
 * 그래서 PNG 를 data URL 로 넘기고 네이티브가 사진 앱에 담은 뒤 결과를 이벤트로 알린다.
 *
 * 응답이 오지 않는 경우(브리지 오류 등)에 영원히 기다리지 않도록 타임아웃을 둔다.
 */
export function saveImageToPhotos(blob: Blob, timeoutMs = 30_000): Promise<SaveImageResult> {
  const bridge = handlers()?.saveImage;
  if (!bridge) return Promise.resolve({ ok: false, reason: 'failed' });

  return new Promise((resolve) => {
    let settled = false;

    function finish(result: SaveImageResult) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      window.removeEventListener(SAVE_IMAGE_EVENT, onResult as EventListener);
      resolve(result);
    }

    function onResult(event: Event) {
      finish((event as CustomEvent<SaveImageResult>).detail ?? { ok: false, reason: 'failed' });
    }

    const timer = setTimeout(() => finish({ ok: false, reason: 'failed' }), timeoutMs);
    window.addEventListener(SAVE_IMAGE_EVENT, onResult as EventListener);

    const reader = new FileReader();
    reader.onerror = () => finish({ ok: false, reason: 'failed' });
    reader.onload = () => bridge.postMessage({ dataUrl: reader.result });
    reader.readAsDataURL(blob);
  });
}

// ── App Store 인앱결제 ──────────────────────────────────────────────────────
//
// 앱 안에서 열리는 유료 템플릿은 외부 결제로 팔 수 없어(App Review Guideline 3.1.1)
// iOS 앱에서는 토스 대신 StoreKit 으로 결제한다. 결제 자체는 네이티브가 하고,
// 웹은 상품 목록을 받아 그리고 결제 결과(서명 영수증)를 서버로 넘기는 일만 한다.
// (네이티브: ios/Picky/Picky/IapBridge.swift)

const IAP_EVENT = 'picky:iap-result';

/** 상품 조회는 네트워크 한 번이면 끝난다 */
const PRODUCTS_TIMEOUT_MS = 20_000;

/**
 * 결제는 사람이 Face ID·비밀번호를 거치는 시간이 있어 넉넉히 잡는다.
 * '구매 요청'(가족 승인 대기)처럼 즉시 끝나지 않는 경우는 네이티브가 pending 으로 바로 답한다.
 */
const PURCHASE_TIMEOUT_MS = 5 * 60_000;

/** App Store 에서 읽어 온 상품 — 가격은 스토어가 정한 표기를 그대로 쓴다 */
export type IapProduct = {
  productId: string;
  /** '₩4,900' 처럼 스토어가 현지화한 가격 문구 */
  displayPrice: string;
};

export type IapFailureReason =
  /** 사용자가 결제창을 닫았다 */
  | 'cancelled'
  /** 가족 승인 대기 등으로 아직 확정되지 않았다 */
  | 'pending'
  /** App Store Connect 에 상품이 없거나 아직 심사 중이다 */
  | 'unavailable'
  /** 서명 검증에 실패했다 (위조 가능성) */
  | 'unverified'
  | 'failed';

export type IapPurchaseResult =
  | { ok: true; transactionId: string; signedTransactionInfo: string }
  | { ok: false; reason: IapFailureReason };

/** 결제는 끝났지만 아직 서버에 적립되지 않은 영수증 */
export type IapReceipt = { transactionId: string; signedTransactionInfo: string };

/**
 * 인앱결제를 쓸 수 있는지.
 *
 * `isNativeApp()` 과 따로 본다 — 인앱결제 브리지가 없는 예전 앱 빌드에서는
 * 토스로 되돌리면 안 되고(심사 위반) 업데이트를 안내해야 하기 때문이다.
 */
export function isIapAvailable(): boolean {
  return Boolean(handlers()?.iap);
}

/** 인앱결제 가능 여부 훅. */
export function useIsIapAvailable(): boolean {
  return useSyncExternalStore(subscribe, isIapAvailable, getServerSnapshot);
}

/** 상품 정보(가격)를 App Store 에서 읽어 온다. 실패하면 빈 배열이다. */
export async function fetchIapProducts(productIds: string[]): Promise<IapProduct[]> {
  if (productIds.length === 0) return [];
  const result = await callIap<{ products?: IapProduct[] }>(
    { action: 'products', productIds },
    PRODUCTS_TIMEOUT_MS,
  );
  return result?.products ?? [];
}

/**
 * 결제를 요청한다.
 *
 * 성공하면 StoreKit 이 서명한 영수증(JWS)을 돌려준다 — 이 값을 서버로 보내야
 * 이용 기간이 부여된다. 네이티브는 서버 적립이 끝난 뒤에 거래를 finish 하므로,
 * 여기서 받은 영수증은 반드시 서버로 넘겨야 한다.
 */
export async function purchaseIapProduct(productId: string): Promise<IapPurchaseResult> {
  const result = await callIap<IapPurchaseResult>(
    { action: 'purchase', productId },
    PURCHASE_TIMEOUT_MS,
  );
  return result ?? { ok: false, reason: 'failed' };
}

/**
 * 아직 적립되지 않은 영수증을 모두 가져온다.
 *
 * 적립 요청이 실패했거나 그 사이 앱이 꺼진 경우를 위한 복구 경로다 — 돈은 빠져나갔는데
 * 이용 기간이 없는 상태로 남지 않게, 결제 화면에 들어올 때마다 확인한다.
 */
export async function restoreIapReceipts(): Promise<IapReceipt[]> {
  const result = await callIap<{ receipts?: IapReceipt[] }>(
    { action: 'restore' },
    PRODUCTS_TIMEOUT_MS,
  );
  return result?.receipts ?? [];
}

/**
 * 적립이 끝난 거래를 닫는다.
 *
 * **서버 적립에 성공한 뒤에만 부른다.** 먼저 닫으면 적립이 실패했을 때 영수증을 다시 얻을
 * 방법이 없어진다. 닫기 전까지 StoreKit 이 거래를 들고 있어 주므로 재시도가 가능하다.
 */
export async function finishIapTransaction(transactionId: string): Promise<void> {
  await callIap<{ ok: boolean }>({ action: 'finish', transactionId }, PRODUCTS_TIMEOUT_MS);
}

/** 인앱결제 브리지 요청 — 공통 요청기에 핸들러·이벤트 이름만 묶어 둔 것이다. */
function callIap<T>(
  payload: { action: string } & Record<string, unknown>,
  timeoutMs: number,
): Promise<T | null> {
  return callBridge<T>('iap', IAP_EVENT, payload, timeoutMs);
}

// ── AdMob 보상형 광고 ───────────────────────────────────────────────────────
//
// AdMob 은 앱 광고를 Mobile Ads SDK 로만 서빙하게 해서, WebView 안에 광고를 심는 것은
// 정책 위반이다. 그래서 결제와 같은 모양으로 나눈다 — 재생은 네이티브가 하고,
// 보상(다시 뽑기)은 여기서 서버에 요청한다. (네이티브: ios/Picky/Picky/AdBridge.swift)

const AD_EVENT = 'picky:ad-result';

/** 미리 받기는 네트워크 한 번이면 끝난다 (동의 양식이 뜨면 그만큼 길어진다) */
const AD_PREPARE_TIMEOUT_MS = 60_000;

/** 광고는 사람이 끝까지 보는 시간이 있어 넉넉히 잡는다 */
const AD_SHOW_TIMEOUT_MS = 10 * 60_000;

export type RewardedAdResult =
  | { ok: true }
  /** 광고를 끝까지 보지 않고 닫았다 — 보상을 주면 안 된다 */
  | { ok: false; reason: 'cancelled' }
  /** 재고가 없거나(노필) 동의를 받지 못해 띄울 광고가 없다 */
  | { ok: false; reason: 'unavailable' }
  | { ok: false; reason: 'failed' };

/**
 * 보상형 광고를 띄울 수 있는지.
 *
 * `isNativeApp()` 과 따로 본다 — 광고 브리지가 없는 예전 앱 빌드와 개발용 브라우저에서는
 * 광고 없이 그냥 다시 뽑게 두어야 하기 때문이다.
 */
export function isRewardedAdAvailable(): boolean {
  return Boolean(handlers()?.ads);
}

/** 보상형 광고 가능 여부 훅. */
export function useIsRewardedAdAvailable(): boolean {
  return useSyncExternalStore(subscribe, isRewardedAdAvailable, getServerSnapshot);
}

/**
 * 광고를 미리 받아 둔다.
 *
 * 버튼을 누른 뒤에 받기 시작하면 광고가 뜨기까지 몇 초를 기다리게 된다. 화면에 들어올 때
 * 한 번 불러 두면 그 시간이 사라진다. 결과는 볼 일이 없어 기다리지 않는다
 * (첫 호출에서 동의 양식·추적 허용을 함께 묻는다).
 */
export function prepareRewardedAd(): void {
  void callBridge('ads', AD_EVENT, { action: 'prepare' }, AD_PREPARE_TIMEOUT_MS);
}

/**
 * 보상형 광고를 띄우고 끝까지 봤는지 돌려준다.
 *
 * `ok: true` 는 네이티브가 AdMob 의 보상 콜백을 받았다는 뜻이다 — 이때만 보상을 준다.
 * 중간에 닫으면 `cancelled` 이므로 호출한 쪽은 아무것도 진행하지 않아야 한다.
 */
export async function showRewardedAd(): Promise<RewardedAdResult> {
  const result = await callBridge<RewardedAdResult>(
    'ads',
    AD_EVENT,
    { action: 'show' },
    AD_SHOW_TIMEOUT_MS,
  );
  return result ?? { ok: false, reason: 'failed' };
}

/**
 * 네이티브에 요청을 보내고 같은 requestId 의 답을 기다린다.
 * 브리지가 없거나 답이 오지 않으면 null 이다 (호출한 쪽이 실패로 처리한다).
 *
 * 요청마다 requestId 를 붙이는 이유: 한 핸들러에 요청이 겹칠 수 있어
 * 이벤트 하나만 보고는 어느 요청의 답인지 알 수 없기 때문이다.
 */
function callBridge<T>(
  handler: string,
  event: string,
  payload: { action: string } & Record<string, unknown>,
  timeoutMs: number,
): Promise<T | null> {
  const bridge = handlers()?.[handler];
  if (!bridge) return Promise.resolve(null);

  const requestId = `${payload.action}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return new Promise((resolve) => {
    let settled = false;

    function finish(value: T | null) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      window.removeEventListener(event, onResult as EventListener);
      resolve(value);
    }

    function onResult(event: Event) {
      const detail = (event as CustomEvent<{ requestId?: string } & T>).detail;
      // 다른 요청의 답이면 흘려보낸다 — 아직 내 답이 올 수 있다.
      if (!detail || detail.requestId !== requestId) return;
      finish(detail);
    }

    const timer = setTimeout(() => finish(null), timeoutMs);
    window.addEventListener(event, onResult as EventListener);

    bridge.postMessage({ ...payload, requestId });
  });
}
