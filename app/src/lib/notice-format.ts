/**
 * 공지 화면의 표시용 값 — 서버 컴포넌트와 클라이언트 컴포넌트가 함께 쓴다.
 *
 * `lib/notices.ts` 는 서버 전용 API 클라이언트(next/headers)를 끌고 오므로,
 * 클라이언트 번들에 들어가도 되는 것만 여기에 둔다.
 */

/** 2026. 9. 23. — 목록·본문의 게시일 표기 (공지는 시각까지 보여 줄 이유가 없다) */
export function formatNoticeDate(value: string | Date): string {
  return new Date(value).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
