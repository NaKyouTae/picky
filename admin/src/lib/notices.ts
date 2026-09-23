/** 서버(NestJS)의 admin-notices 응답 타입 — 브라우저/서버 컴포넌트 공용 */

export type NoticeStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export const NOTICE_STATUSES: NoticeStatus[] = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];

export const NOTICE_STATUS_LABELS: Record<NoticeStatus, string> = {
  DRAFT: '작성 중',
  PUBLISHED: '공개',
  ARCHIVED: '보관',
};

export const NOTICE_STATUS_STYLES: Record<NoticeStatus, string> = {
  DRAFT: 'bg-amber-50 text-amber-700',
  PUBLISHED: 'bg-emerald-50 text-emerald-700',
  ARCHIVED: 'bg-gray-100 text-ink-sub',
};

export type AdminNotice = {
  id: string;
  title: string;
  content: string;
  status: NoticeStatus;
  /** 앱 목록 맨 위 고정 */
  isPinned: boolean;
  /** 앱에 보이는 게시 시각. 공개로 바꾸면 서버가 비어 있을 때 현재 시각으로 채운다 */
  publishedAt: string | null;
  /** JSON 직렬화를 거치므로 ISO 문자열로 도착한다 */
  createdAt: string;
  updatedAt: string;
};

export type AdminNoticePage = {
  items: AdminNotice[];
  /** null 이면 마지막 페이지 */
  nextCursor: string | null;
};

/** 한 페이지 크기 — 서버 기본값과 맞춘다 */
export const NOTICE_PAGE_SIZE = 20;

/**
 * 공개 상태인데 게시 시각이 아직 오지 않은 공지 — 앱에는 보이지 않는다.
 * 관리자가 "공개로 했는데 왜 안 보이지" 하고 헤매지 않도록 목록에 예약으로 표시한다.
 */
export function isScheduled(notice: AdminNotice): boolean {
  return (
    notice.status === 'PUBLISHED' &&
    notice.publishedAt !== null &&
    new Date(notice.publishedAt).getTime() > Date.now()
  );
}

/**
 * ISO → `datetime-local` 입력값 (`YYYY-MM-DDTHH:mm`).
 *
 * toISOString() 은 UTC 라 그대로 쓰면 관리자가 넣은 시각이 9시간 밀린다 —
 * 로컬 시간대의 각 자리를 직접 조립한다.
 */
export function toDateTimeInput(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const pad = (value: number) => String(value).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/** `datetime-local` 입력값 → ISO (빈 칸은 null — 서버가 "비우기" 로 받는다) */
export function fromDateTimeInput(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
