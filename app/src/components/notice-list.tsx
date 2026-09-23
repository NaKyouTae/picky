'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import { SparkleMark } from '@/components/sparkle-mark';
import { formatNoticeDate } from '@/lib/notice-format';
import type { NoticePage, NoticeRow } from '@/lib/notices';

/**
 * 공지사항 목록 — 결제 내역과 같은 다크 카드 톤이다.
 *
 * 첫 페이지는 서버 컴포넌트가 넘겨주고, '더 보기' 는 커서로 이어 받는다
 * (offset 을 쓰면 뒤 페이지로 갈수록 느려지므로).
 * 고정 공지는 서버가 이미 맨 위로 올려 보내므로 여기서 다시 정렬하지 않는다.
 */
export function NoticeList({ first }: { first: NoticePage }) {
  const [notices, setNotices] = useState<NoticeRow[]>(first.items);
  const [cursor, setCursor] = useState(first.nextCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMore = useCallback(async () => {
    if (!cursor) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/notices?cursor=${cursor}`, { cache: 'no-store' });
      if (!res.ok) throw new Error();

      const next = (await res.json()) as NoticePage;
      setNotices((current) => [...current, ...next.items]);
      setCursor(next.nextCursor);
    } catch {
      setError('더 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  }, [cursor]);

  if (notices.length === 0) {
    // 빈 화면 — 남은 높이 가운데에 마크와 문구만 둔다 (결제 내역의 빈 화면과 같은 짜임).
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 pb-9 text-center">
        <SparkleMark />
        <p className="text-[16px] font-medium leading-[1.6]">아직 공지사항이 없어요.</p>
        <p className="text-[14px] leading-[1.6] text-night-sub">
          새로운 소식이 생기면
          <br />
          이곳에 올려 드릴게요 !
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <ol className="flex flex-col gap-2.5">
        {notices.map((notice) => (
          <li key={notice.id}>
            <Link
              href={`/mypage/notices/${notice.id}`}
              className="flex items-center gap-3 rounded-lg bg-night-card p-5 active:opacity-70"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-2.5">
                {notice.isPinned && (
                  <span className="self-start bg-picky-red p-1 text-[12px] leading-none">중요</span>
                )}
                {/* 제목은 두 줄까지 보여 주고 그 뒤는 줄인다 — 본문은 눌러서 읽는다 */}
                <p className="line-clamp-2 text-[16px] font-medium leading-[1.4]">{notice.title}</p>
                <p className="text-[14px] font-medium leading-none text-night-sub">
                  {formatNoticeDate(notice.publishedAt)}
                </p>
              </div>
              <ChevronIcon />
            </Link>
          </li>
        ))}
      </ol>

      {error && <p className="mt-2 text-center text-[12px] text-picky-red">{error}</p>}

      {cursor && (
        <button
          type="button"
          onClick={() => void loadMore()}
          disabled={loading}
          className="mt-2 h-12 w-full rounded-lg border border-night-raised text-[14px] text-night-sub active:bg-night-card disabled:opacity-60"
        >
          {loading ? '불러오는 중…' : '더 보기'}
        </button>
      )}
    </div>
  );
}

function ChevronIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className="size-6 shrink-0 text-night-sub"
      aria-hidden
    >
      <path d="M8.59 16.59 13.17 12 8.59 7.41 10 6l6 6-6 6z" />
    </svg>
  );
}
