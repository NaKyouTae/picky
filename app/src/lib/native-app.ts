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
