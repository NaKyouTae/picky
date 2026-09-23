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

      {/* 애플은 선택이 아니다 — 소셜 로그인만 제공하는 앱은 함께 내야 심사를 통과한다
          (App Store 심사 지침 4.8). 색·심볼은 애플의 표시 규정을 따라 검정 바탕에 흰 로고다. */}
      <ProviderButton
        provider="apple"
        label="Apple로 계속하기"
        recent={recent === 'apple'}
        className="bg-black text-white"
      >
        <AppleSymbol />
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

/** 애플 로고 — 애플이 배포하는 마크와 같은 실루엣. 색은 버튼 글자색을 따른다 */
function AppleSymbol() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M16.36 12.65c-.02-2.3 1.88-3.4 1.96-3.45-1.07-1.56-2.73-1.78-3.32-1.8-1.41-.14-2.76.83-3.48.83-.72 0-1.83-.81-3-.79-1.55.02-2.98.9-3.77 2.28-1.61 2.79-.41 6.92 1.15 9.18.76 1.11 1.67 2.35 2.86 2.3 1.15-.05 1.58-.74 2.97-.74 1.39 0 1.78.74 2.99.72 1.23-.02 2.02-1.12 2.78-2.24.87-1.29 1.23-2.54 1.25-2.6-.03-.01-2.4-.92-2.42-3.65ZM14.1 5.9c.63-.77 1.06-1.83.94-2.9-.91.04-2.02.61-2.67 1.37-.58.68-1.09 1.77-.95 2.81 1.02.08 2.05-.52 2.68-1.28Z" />
    </svg>
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
