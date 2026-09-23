import Image from 'next/image';
import type { OAuthProvider } from '@/lib/oauth-flow';
import { cn } from '@/lib/utils';

/**
 * 로그인 화면의 제공자 버튼들 (디자인 "로그인" 4584:4853).
 *
 * OAuth 는 top-level 내비게이션이어야 하므로 fetch 가 아니라 링크로 이동한다
 * (`/auth/{provider}/start` 가 일회용 쿠키를 심고 제공자 동의 화면으로 리디렉션).
 */
export function LoginButtons({ recent }: { recent?: OAuthProvider | null }) {
  return (
    // 말풍선을 버튼 위에 얹으려면 이 블록이 기준점이어야 한다
    <div className="relative flex w-full max-w-[345px] flex-col items-center gap-2">
      <ProviderButton
        provider="kakao"
        label="카카오로 계속하기"
        recent={recent === 'kakao'}
        className="bg-kakao text-night active:bg-kakao-pressed"
      >
        <KakaoSymbol />
      </ProviderButton>

      <ProviderButton
        provider="naver"
        label="네이버로 계속하기"
        recent={recent === 'naver'}
        className="bg-naver text-night-text"
      >
        <Image src="/naver.svg" alt="" width={24} height={24} unoptimized />
      </ProviderButton>
    </div>
  );
}

/** 버튼 한 개 — 디자인의 `button_large` (345x52, 아이콘 24, 라벨은 남은 폭에서 가운데) */
function ProviderButton({
  provider,
  label,
  children,
  className,
  recent = false,
}: {
  provider: OAuthProvider;
  label: string;
  children: React.ReactNode;
  className?: string;
  /** 마지막으로 로그인한 제공자면 위에 말풍선을 띄운다 */
  recent?: boolean;
}) {
  return (
    <div className="relative w-full">
      {recent && <RecentBadge />}
      <a
        href={`/auth/${provider}/start`}
        className={cn(
          'flex h-[52px] w-full items-center justify-center gap-2.5 rounded-lg px-5',
          className,
        )}
      >
        <span className="flex size-6 shrink-0 items-center justify-center">{children}</span>
        <span className="flex-1 text-center text-[16px] font-medium leading-none">{label}</span>
      </a>
    </div>
  );
}

/**
 * '최근 로그인' 말풍선 — 둥근 알약 + 아래를 가리키는 꼬리.
 * 디자인에는 카카오 버튼 위에 그려져 있지만 가리키는 대상은 사람마다 다르므로,
 * 고정 좌표의 SVG 대신 버튼에 붙는 형태로 만든다 (치수는 원본 그대로: 알약 28px, 꼬리 12.7x11).
 */
function RecentBadge() {
  return (
    <span className="absolute -top-8 right-2 z-10">
      <span className="block rounded-full bg-night/80 px-3 py-2 text-[12px] font-medium leading-none text-night-text">
        최근 로그인
      </span>
      <span
        aria-hidden
        className="absolute left-1/2 top-full size-0 -translate-x-1/2 border-x-[6.35px] border-t-[11px] border-x-transparent border-t-night/80"
      />
    </span>
  );
}

/** 카카오 말풍선 마크 — 디자인 자산과 같은 모양이라 기존 것을 그대로 쓴다 */
function KakaoSymbol() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M12 3C6.48 3 2 6.54 2 10.9c0 2.79 1.84 5.24 4.6 6.64-.2.74-.73 2.68-.84 3.1-.13.51.19.5.4.37.16-.11 2.6-1.78 3.66-2.5.71.1 1.44.16 2.18.16 5.52 0 10-3.54 10-7.77C22 6.54 17.52 3 12 3Z" />
    </svg>
  );
}
