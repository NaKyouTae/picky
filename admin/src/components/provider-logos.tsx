/**
 * SNS 제공자 로고 — 사용자 목록의 제공자 컬럼에 연결 이력이 있을 때만 표시한다.
 * 각 사 브랜드 가이드의 기본 심볼을 20px 배지로 단순화했다.
 */
import type { ProviderType } from '@/lib/users';

function KakaoLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <rect width="20" height="20" rx="5" fill="#FEE500" />
      <path
        fill="#3C1E1E"
        d="M10 4.4c-3.03 0-5.5 1.94-5.5 4.34 0 1.53.99 2.88 2.49 3.65-.11.4-.4 1.47-.46 1.7-.07.28.1.28.22.2.09-.06 1.42-.97 2-1.37.4.06.79.09 1.2.09 3.04 0 5.5-1.95 5.5-4.35S13.04 4.4 10 4.4Z"
      />
    </svg>
  );
}

function NaverLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <rect width="20" height="20" rx="5" fill="#03C75A" />
      <path fill="#fff" d="M11.03 10.3 8.72 6.9H6.5v6.2h2.36V9.64l2.36 3.46h2.28V6.9h-2.47v3.4Z" />
    </svg>
  );
}

const LOGOS: Record<ProviderType, () => React.JSX.Element> = {
  KAKAO: KakaoLogo,
  NAVER: NaverLogo,
};

/** 해당 제공자로 가입 이력이 있으면 로고, 없으면 빈 자리 표시 */
export function ProviderCell({ provider, linked }: { provider: ProviderType; linked: boolean }) {
  if (!linked) {
    return <span className="text-line select-none">—</span>;
  }

  const Logo = LOGOS[provider];
  return (
    <span className="inline-flex" title={PROVIDER_LABELS[provider]}>
      <Logo />
      <span className="sr-only">{PROVIDER_LABELS[provider]} 연결됨</span>
    </span>
  );
}

export const PROVIDER_LABELS: Record<ProviderType, string> = {
  KAKAO: '카카오',
  NAVER: '네이버',
};
