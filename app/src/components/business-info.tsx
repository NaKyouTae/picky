import { BUSINESS } from '@/lib/business';
import { cn } from '@/lib/utils';

/**
 * 사업자 정보 표시 — 전자상거래법 제10조.
 *
 * **초기 화면(홈·로그인)에서 바로 보여야 한다.** 네이버 로그인 검수는 이 정보가 서비스
 * 초기 화면이나 푸터에서 확인되지 않으면 반려한다(2026-09-23 1차 반려 사유).
 * 그래서 접었다 펴는 형태로 두지 않고 항상 펼쳐 둔다.
 *
 * 값은 `lib/business.ts` 한 곳에서만 가져온다.
 */
export function BusinessInfo({
  align = 'center',
  className,
}: {
  /** 홈·로그인은 가운데, 마이페이지는 왼쪽 정렬이다 */
  align?: 'center' | 'left';
  className?: string;
}) {
  return (
    <address
      className={cn(
        'text-[11px] not-italic leading-relaxed text-night-sub',
        align === 'center' ? 'text-center' : 'text-left',
        className,
      )}
    >
      <span className="block">
        {BUSINESS.name} · 대표 {BUSINESS.ceo}
      </span>
      <span className="block">사업자등록번호 {BUSINESS.registrationNumber}</span>
      <span className="block">통신판매업신고 {BUSINESS.mailOrderNumber}</span>
      <span className="block">{BUSINESS.address}</span>
      <span className="block">
        문의{' '}
        <a href={`mailto:${BUSINESS.email}`} className="underline underline-offset-2">
          {BUSINESS.email}
        </a>
      </span>
    </address>
  );
}
