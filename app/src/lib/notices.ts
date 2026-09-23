import { api } from '@/lib/api';

// 화면 표시용 포맷터는 `lib/notice-format.ts` 에 있다 —
// 이 파일은 next/headers 를 쓰는 서버 전용이라 클라이언트 번들에 들어가면 안 된다.

/** 공지 목록 한 줄 — 본문은 싣지 않는다 (공지 하나가 화면 몇 개 분량일 수 있다) */
export type NoticeRow = {
  id: string;
  title: string;
  /** 목록 맨 위에 고정된 공지 — '중요' 배지를 붙인다 */
  isPinned: boolean;
  /** 게시 시각 (ISO) — 공개된 공지는 반드시 있다 */
  publishedAt: string;
};

export type NoticePage = {
  items: NoticeRow[];
  /** null 이면 마지막 페이지 */
  nextCursor: string | null;
};

/** 공지 본문 — 서식 없는 글이라 줄바꿈만 살려 보여준다 */
export type Notice = NoticeRow & { content: string };

/** 공지 목록 첫 페이지 — 서버 컴포넌트 전용 (브라우저는 BFF `/api/notices`) */
export async function getNotices(take = 20): Promise<NoticePage> {
  return api
    .get<NoticePage>(`/notices?take=${take}`, { cache: 'no-store' })
    .catch(() => ({ items: [], nextCursor: null }));
}

/**
 * 공지 단건 — 서버 컴포넌트 전용.
 * 공개되지 않은(작성 중·보관·예약) 공지는 서버가 404 를 주므로 null 로 돌려 notFound() 를 띄운다.
 */
export async function getNotice(id: string): Promise<Notice | null> {
  return api.get<Notice>(`/notices/${id}`, { cache: 'no-store' }).catch(() => null);
}
