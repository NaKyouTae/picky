import Image from 'next/image';
import { cn } from '@/lib/utils';

/**
 * 로고 마크의 색 변형 — SVG 원본에 색이 박혀 있어 CSS 로 바꿀 수 없다.
 * 디자인이 쓰는 두 가지를 각각 파일로 두고 고른다.
 * (point = 다크 메인 화면, black = 밝은 로그인 화면)
 */
type LogoTone = 'point' | 'black';

const MARK_SRC: Record<LogoTone, string> = {
  point: '/logo.svg',
  black: '/logo-black.svg',
};

/**
 * Picky 로고 마크 — 디자인(Figma)에서 내려받은 벡터 원본을 그대로 쓴다.
 * 이전에는 19x20 PNG 였는데 레티나에서 계단이 보여 SVG 로 교체했다.
 * 로고는 화면마다 다시 그리지 않고 이 컴포넌트만 쓴다.
 */
export function LogoMark({ tone = 'point', className }: { tone?: LogoTone; className?: string }) {
  return (
    <Image
      src={MARK_SRC[tone]}
      alt=""
      width={187}
      height={193}
      priority
      unoptimized
      className={className}
    />
  );
}

/**
 * 마크 + 워드마크. 글자색·크기는 넘겨받은 className 으로 정하고,
 * 마크 색만 tone 으로 고른다 (SVG 에 박힌 색이라 상속되지 않는다).
 */
export function Logo({
  tone = 'point',
  wordmark = 'Picky',
  markClassName = 'size-[1em]',
  className,
}: {
  tone?: LogoTone;
  /** 워드마크 표기 — 디자인은 어느 화면에서나 대문자로 시작하는 'Picky' 다 */
  wordmark?: string;
  /**
   * 마크 크기 — 기본값은 글자 크기와 같은 정사각(메인 20px, 로그인 36px 프레임 그대로).
   * 회원권 구매 화면만 36px 글자에 32px 마크를 써서 따로 넘긴다.
   */
  markClassName?: string;
  className?: string;
}) {
  return (
    // 디자인은 워드마크를 Regular 로 쓴다 — 굵게 만들지 않는다.
    // 마크는 정사각이다 — 원본 벡터는 세로가 조금 길지만(18.7x19.3) 디자인이 정사각 칸에
    // 눌러 담아 쓴다. SVG 가 preserveAspectRatio="none" 이라 그대로 늘어난다.
    // 간격은 글자 크기에 비례한다 (0.1613em — 20px 에서 3.226px, 36px 에서 5.806px).
    <span className={cn('flex items-center gap-[0.16em] font-mono', className)}>
      <LogoMark tone={tone} className={markClassName} />
      {wordmark}
    </span>
  );
}
