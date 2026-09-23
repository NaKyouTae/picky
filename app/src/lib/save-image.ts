'use client';

import { isNativeApp, saveImageToPhotos } from '@/lib/native-app';

/** 저장 결과 — 실패하면 화면에 그대로 띄울 문구가 함께 온다 */
export type SaveImageOutcome = { ok: true } | { ok: false; message: string };

/**
 * 이미지를 기기에 저장한다.
 *
 * 웹에서는 앵커에 blob URL 을 달아 브라우저 저장을 부른다.
 * 네이티브 앱(WKWebView)은 `<a download>` 를 무시해서 이 방식이 아무 일도 하지 않으므로,
 * 이미지를 네이티브로 넘겨 사진 앱에 담는다 (ios/Picky/Picky/WebView.swift).
 *
 * 콜라주를 만든 직후(콜라주 화면)와 나중에 다시 받을 때('완료한 챌린지')가 같은 경로를 쓴다.
 */
export async function saveImageBlob(blob: Blob, filename: string): Promise<SaveImageOutcome> {
  if (isNativeApp()) {
    const saved = await saveImageToPhotos(blob);
    if (saved.ok) return { ok: true };
    return {
      ok: false,
      message:
        saved.reason === 'denied'
          ? '사진 접근을 허용해야 저장할 수 있어요. 설정에서 바꿔 주세요.'
          : '저장하지 못했어요. 다시 시도해 주세요.',
    };
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  // 클릭 직후 바로 거둬들이면 저장이 시작되기 전에 끊길 수 있다.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return { ok: true };
}
