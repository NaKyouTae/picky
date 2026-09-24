'use client';

import { useCallback, useState } from 'react';
import { SparkleMark } from '@/components/sparkle-mark';
import { formatNoticeDate, noticePreview } from '@/lib/notice-format';
import type { Notice, NoticePage } from '@/lib/notices';

/**
 * 공지사항 목록 — 디자인(Figma 4694:5690, 빈 화면 4694:5395)의 다크 카드.
 *
 * 카드를 펼쳐 그 자리에서 읽는 아코디언이라 상세 화면이 없다. 접혀 있을 때는 본문 두 줄만 보이고,
 * '펼치기' 를 누르면 전문이 열리면서 그 공지를 읽은 것으로 기록한다 — 제목 앞 (New) 가 그때 사라진다.
 *
 * 첫 페이지는 서버 컴포넌트가 넘겨주고, '더 보기' 는 커서로 이어 받는다
 * (offset 을 쓰면 뒤 페이지로 갈수록 느려지므로).
 */
export function NoticeList({ first }: { first: NoticePage }) {
  const [notices, setNotices] = useState<Notice[]>(first.items);
  const [cursor, setCursor] = useState(first.nextCursor);
  /** 펼쳐 둔 공지 — 여러 개를 동시에 열어 둘 수 있다 */
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = useCallback((notice: Notice) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(notice.id)) next.delete(notice.id);
      else next.add(notice.id);
      return next;
    });

    // 펼치는 순간 읽은 것으로 본다. 화면에서는 (New) 를 바로 떼고 기록은 뒤따라 보낸다 —
    // 실패해도 다음에 들어오면 (New) 가 그대로 있을 뿐이라 되돌리지 않는다.
    if (notice.isRead) return;
    setNotices((current) =>
      current.map((item) => (item.id === notice.id ? { ...item, isRead: true } : item)),
    );
    void fetch(`/api/notices/${notice.id}/read`, { method: 'POST', cache: 'no-store' }).catch(
      () => null,
    );
  }, []);

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
    // 빈 화면(4694:5404) — 헤더 아래 36px 지점에 마크부터 쌓는다 (가운데 정렬이 아니다).
    return (
      <div className="flex flex-1 flex-col items-center gap-4 py-9 text-center">
        <SparkleMark />
        <p className="text-[16px] leading-[1.6]">
          PICKY의 새로운 소식을
          <br />
          가장 먼저 만나보세요 !
        </p>
        <p className="text-[14px] leading-[1.6] text-night-sub">아직 등록된 공지사항이 없어요.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <ol className="flex flex-col gap-2.5">
        {notices.map((notice) => {
          const open = expanded.has(notice.id);

          return (
            <li key={notice.id} className="flex flex-col gap-2.5 rounded-lg bg-night-card p-5">
              <h2 className="text-[16px] font-medium leading-[1.6]">
                {/* 아직 확인하지 않은 공지 — 디자인(4694:5795)의 point 색 (New) 머리말 */}
                {!notice.isRead && <span className="text-point">(New) </span>}
                {notice.title}
              </h2>

              {open ? (
                <p className="whitespace-pre-line text-[14px] leading-[1.6]">{notice.content}</p>
              ) : (
                <p className="line-clamp-2 text-[14px] leading-[1.6]">
                  {noticePreview(notice.content)}
                </p>
              )}

              <div className="flex items-center justify-between gap-3 text-[12px] leading-[1.6] text-night-sub">
                <span>{formatNoticeDate(notice.publishedAt)}</span>
                <button
                  type="button"
                  onClick={() => toggle(notice)}
                  aria-expanded={open}
                  // 12px 글자라 그대로 두면 터치 타깃이 너무 작다 — 보이는 자리는 그대로 두고
                  // 패딩으로 누를 수 있는 높이만 넓힌다 (카드 아래 여백 20px 안에서 흡수된다).
                  className="-m-3 shrink-0 p-3 active:opacity-60"
                >
                  {open ? '접기' : '펼치기'}
                </button>
              </div>
            </li>
          );
        })}
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
