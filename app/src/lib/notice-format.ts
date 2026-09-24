/**
 * 공지 화면의 표시용 값 — 서버 컴포넌트와 클라이언트 컴포넌트가 함께 쓴다.
 *
 * `lib/notices.ts` 는 서버 전용 API 클라이언트(next/headers)를 끌고 오므로,
 * 클라이언트 번들에 들어가도 되는 것만 여기에 둔다.
 */

/**
 * 2026.9.23. — 카드 아래 게시일 표기 (디자인 Figma 4694:5802).
 *
 * toLocaleDateString('ko-KR') 은 '2026. 9. 23.' 처럼 사이에 공백을 넣어서 직접 조립한다.
 * 0 은 채우지 않는다 (디자인이 9월을 '9.' 로 쓴다).
 */
export function formatNoticeDate(value: string | Date): string {
  const date = new Date(value);
  return `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}.`;
}

/**
 * 접었을 때 보여 줄 두 줄 미리보기용 본문.
 *
 * 줄바꿈을 공백으로 눕힌다 — 펼친 본문은 줄바꿈을 그대로 살리지만, 미리보기에서까지
 * 그러면 첫 줄이 짧은 공지는 두 줄 중 한 줄을 빈칸으로 버린다.
 */
export function noticePreview(content: string): string {
  return content.replace(/\s*\n+\s*/g, ' ').trim();
}
