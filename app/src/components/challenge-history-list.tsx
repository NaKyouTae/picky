'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import type { ChallengeGroup, ChallengeHistoryPage } from '@/lib/challenges';
import { getCollageDownload } from '@/lib/collages';
import { saveImageBlob } from '@/lib/save-image';

/** 콜라주를 못 받았을 때 구매 화면으로 보내는 링크 — 결제를 마치면 이 목록으로 돌아온다 */
const MEMBERSHIP_HREF = `/membership?returnTo=${encodeURIComponent('/mypage/challenges')}`;

/** 내려받기 결과 안내 — 누른 카드 아래에만 보여 준다 (목록이 길어 위에 띄우면 안 보인다) */
type Feedback = { groupId: string; text: string; needsMembership: boolean };

/** "2026. 09. 22." — 목록에서는 시각까지 보여 줄 이유가 없다 */
function formatDate(iso: string | null): string {
  const date = iso ? new Date(iso) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}. ${month}. ${day}.`;
}

/**
 * 완료한 챌린지 내역.
 *
 * 첫 페이지는 서버 컴포넌트가 넘겨주고, '더 보기' 는 커서로 이어 받는다
 * (offset 을 쓰면 뒤 페이지로 갈수록 느려지므로).
 */
export function ChallengeHistoryList({ first }: { first: ChallengeHistoryPage }) {
  const [groups, setGroups] = useState<ChallengeGroup[]>(first.items);
  const [cursor, setCursor] = useState(first.nextCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** 지금 내려받는 중인 그룹 — 한 번에 하나만 받는다 */
  const [downloading, setDownloading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  /**
   * 보관해 둔 콜라주 다시 받기 — **유료 회원 전용**이다.
   *
   * 회원권 기간이 끝났으면 서버가 403 을 주고, 파일은 그대로 남아 있으므로
   * 다시 구매하면 예전 콜라주를 그대로 받을 수 있다. 그래서 막혔을 때는 구매 링크를 함께 보여 준다.
   */
  const downloadCollage = useCallback(async (groupId: string) => {
    setDownloading(groupId);
    setFeedback(null);
    try {
      const found = await getCollageDownload(groupId);
      if (!found.ok) {
        setFeedback({
          groupId,
          needsMembership: found.reason === 'membership',
          text:
            found.reason === 'membership'
              ? '회원권이 있어야 지난 콜라주를 다시 받을 수 있어요.'
              : found.reason === 'missing'
                ? '보관된 콜라주가 없어요.'
                : '내려받지 못했어요. 잠시 후 다시 시도해 주세요.',
        });
        return;
      }

      // private 버킷의 짧은 signed URL — 받아서 기기에 저장한다 (앱은 사진 앱에 담는다).
      const res = await fetch(found.url, { cache: 'no-store' });
      if (!res.ok) throw new Error();

      const saved = await saveImageBlob(await res.blob(), `picky-${groupId}.png`);
      setFeedback({
        groupId,
        needsMembership: false,
        text: saved.ok ? '사진을 저장했어요.' : saved.message,
      });
    } catch {
      setFeedback({
        groupId,
        needsMembership: false,
        text: '내려받지 못했어요. 잠시 후 다시 시도해 주세요.',
      });
    } finally {
      setDownloading(null);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!cursor) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/challenge-groups/history?cursor=${cursor}`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error();

      const next = (await res.json()) as ChallengeHistoryPage;
      setGroups((current) => [...current, ...next.items]);
      setCursor(next.nextCursor);
    } catch {
      setError('더 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  }, [cursor]);

  if (groups.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-5 text-center">
        <p className="text-base font-semibold">아직 완료한 챌린지가 없어요</p>
        <p className="mt-2 text-sm text-ink-sub">
          카테고리를 골라 챌린지를 다섯 개 끝내면 여기에 남아요.
        </p>
        <Link
          href="/"
          className="mt-6 flex h-12 w-full items-center justify-center rounded-2xl bg-brand-500 text-base font-semibold text-white active:bg-brand-600"
        >
          챌린지 시작하기
        </Link>
      </div>
    );
  }

  return (
    <div className="px-5 pt-2">
      <p className="text-sm text-ink-sub">{groups.length}개의 챌린지를 끝냈어요</p>

      <ol className="mt-4 space-y-3">
        {groups.map((group) => {
          // 다시 뽑기로 교체된 칸은 남지 않으므로, 완료한 칸이 곧 해낸 챌린지다.
          const done = group.items.filter((item) => item.completedAt !== null);

          return (
            <li key={group.id} className="rounded-2xl border border-line bg-white p-4">
              <div className="flex items-baseline gap-2">
                <p className="text-base font-bold">
                  {group.category.emoji} {group.category.name}
                </p>
                <p className="ml-auto shrink-0 text-xs text-ink-sub">
                  {formatDate(group.completedAt ?? group.createdAt)}
                </p>
              </div>
              <p className="mt-1 text-xs text-ink-sub">챌린지 {done.length}개 완료</p>

              <ol className="mt-3 space-y-1.5 border-t border-line pt-3">
                {done.map((item) => (
                  <li key={item.id} className="flex gap-2 text-sm">
                    <span className="shrink-0 text-ink-sub">{item.position}</span>
                    <span className="min-w-0 flex-1">
                      {item.challenge.emoji} {item.challenge.title}
                    </span>
                  </li>
                ))}
              </ol>

              {/* 보관본이 있을 때만 — 누르면 서버가 회원권을 확인한다(무료면 구매 안내) */}
              {group.collage && (
                <button
                  type="button"
                  onClick={() => void downloadCollage(group.id)}
                  disabled={downloading === group.id}
                  className="mt-3 h-11 w-full rounded-xl border border-line bg-white text-sm font-semibold text-brand-600 active:bg-canvas disabled:opacity-60"
                >
                  {downloading === group.id ? '내려받는 중…' : '콜라주 내려받기'}
                </button>
              )}

              {feedback?.groupId === group.id && (
                <div role="status" className="mt-2 text-center text-sm text-ink-sub">
                  <p>{feedback.text}</p>
                  {feedback.needsMembership && (
                    <Link
                      href={MEMBERSHIP_HREF}
                      className="mt-2 flex h-11 w-full items-center justify-center rounded-xl bg-brand-500 text-sm font-semibold text-white active:bg-brand-600"
                    >
                      회원권 구매하기
                    </Link>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {error && <p className="mt-3 text-center text-sm text-brand-600">{error}</p>}

      {cursor && (
        <button
          type="button"
          onClick={() => void loadMore()}
          disabled={loading}
          className="mt-4 h-12 w-full rounded-2xl border border-line bg-white text-sm font-semibold text-ink-sub active:bg-canvas disabled:opacity-60"
        >
          {loading ? '불러오는 중…' : '더 보기'}
        </button>
      )}
    </div>
  );
}
