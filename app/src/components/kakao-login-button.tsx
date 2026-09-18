'use client';

type KakaoLoginButtonProps = {
  /** 미지정 시 연동 전 안내만 남깁니다. OAuth 연결 후 인가 URL 이동으로 교체하세요. */
  onClick?: () => void;
};

export function KakaoLoginButton({ onClick }: KakaoLoginButtonProps) {
  const handleClick =
    onClick ??
    (() => {
      // TODO: 카카오 OAuth 연동 — 서버의 인가 URL 로 이동
      // window.location.href = '/api/auth/kakao';
      console.warn('[picky] 카카오 로그인은 아직 연동되지 않았습니다.');
    });

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-kakao text-base font-semibold text-kakao-label transition-colors active:bg-kakao-pressed"
    >
      <KakaoSymbol />
      카카오 로그인
    </button>
  );
}

function KakaoSymbol() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M12 3C6.48 3 2 6.54 2 10.9c0 2.79 1.84 5.24 4.6 6.64-.2.74-.73 2.68-.84 3.1-.13.51.19.5.4.37.16-.11 2.6-1.78 3.66-2.5.71.1 1.44.16 2.18.16 5.52 0 10-3.54 10-7.77C22 6.54 17.52 3 12 3Z" />
    </svg>
  );
}
