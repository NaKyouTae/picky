/**
 * 카카오 로그인 버튼.
 * OAuth 는 top-level 내비게이션이어야 하므로 fetch 가 아니라 링크로 이동한다.
 * (`/auth/kakao/start` 가 state/nonce 쿠키를 심고 카카오 동의 화면으로 리디렉션)
 */
export function KakaoLoginButton() {
  return (
    <a
      href="/auth/kakao/start"
      className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-kakao text-base font-semibold text-kakao-label transition-colors active:bg-kakao-pressed"
    >
      <KakaoSymbol />
      카카오 로그인
    </a>
  );
}

function KakaoSymbol() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M12 3C6.48 3 2 6.54 2 10.9c0 2.79 1.84 5.24 4.6 6.64-.2.74-.73 2.68-.84 3.1-.13.51.19.5.4.37.16-.11 2.6-1.78 3.66-2.5.71.1 1.44.16 2.18.16 5.52 0 10-3.54 10-7.77C22 6.54 17.52 3 12 3Z" />
    </svg>
  );
}
