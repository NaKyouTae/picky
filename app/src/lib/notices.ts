import { api } from '@/lib/api';

// 화면 표시용 포맷터는 `lib/notice-format.ts` 에 있다 —
// 이 파일은 next/headers 를 쓰는 서버 전용이라 클라이언트 번들에 들어가면 안 된다.

/**
 * 공지 한 건.
 *
 * 본문까지 목록에 실려 온다 — 카드를 펼쳐 그 자리에서 읽으므로 상세 화면이 없다
 * (디자인 Figma 4694:5690).
 */
export type Notice = {
  id: string;
  title: string;
  /** 서식 없는 글 — 줄바꿈만 살려 보여준다 */
  content: string;
  /** 목록 맨 위에 고정된 공지 */
  isPinned: boolean;
  /** 게시 시각 (ISO) */
  publishedAt: string;
  /** 펼쳐 읽은 적이 있는지 — false 면 제목 앞에 (New) 가 붙는다 */
  isRead: boolean;
};

export type NoticePage = {
  items: Notice[];
  /** null 이면 마지막 페이지 */
  nextCursor: string | null;
};

/** 공지 목록 첫 페이지 — 서버 컴포넌트 전용 (브라우저는 BFF `/api/notices`) */
export async function getNotices(take = 20): Promise<NoticePage> {
  return api
    .get<NoticePage>(`/notices?take=${take}`, { cache: 'no-store' })
    .catch(() => ({ items: [], nextCursor: null }));
}

/**
 * 아직 확인하지 않은 공지가 있는지 — 마이페이지 메뉴의 점 하나를 켜는 값이다.
 * 조회에 실패하면 점을 붙이지 않는다 (없는 알림을 띄우는 것보다 조용한 편이 낫다).
 */
export async function hasUnreadNotices(): Promise<boolean> {
  return api
    .get<{ hasUnread: boolean }>('/notices/unread', { cache: 'no-store' })
    .then((res) => res.hasUnread)
    .catch(() => false);
}
