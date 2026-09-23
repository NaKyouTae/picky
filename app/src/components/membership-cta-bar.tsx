/**
 * 회원권 구매 화면 하단에 고정되는 CTA.
 *
 * 앱 셸이 translate 로 fixed 의 컨테이닝 블록이라 이 바는 셸 하단에 정확히 붙는다.
 * 디자인처럼 위로 검정 그라데이션을 깔아 스크롤되는 카드가 버튼 뒤로 자연스럽게 사라지게 한다
 * (아래 여백 20px).
 */
export function MembershipCtaBar({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 bg-[linear-gradient(to_bottom,transparent_0%,#000_20%)] px-5 pt-6"
      style={{ paddingBottom: '20px' }}
    >
      {children}
    </div>
  );
}

/** 고정 CTA 에 가려지지 않도록 본문 아래에 두는 여백 (바 높이 + 24px) */
export const MEMBERSHIP_CTA_SPACE = '120px';

/**
 * 고정 CTA 의 초록 버튼 모양 — 웹(결제 화면으로 이동하는 링크)과 앱(인앱결제를 실행하는 버튼)이
 * 같은 자리에 같은 모양으로 서야 해서 클래스만 한곳에 둔다.
 */
export const MEMBERSHIP_CTA_CLASS =
  'flex h-[52px] w-full items-center justify-center rounded-lg bg-point px-5 text-[16px] font-medium text-night active:bg-main disabled:opacity-60';
