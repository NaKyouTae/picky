'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { SparkleMark } from '@/components/sparkle-mark';
import type { ChallengeGroup, ChallengeHistoryPage } from '@/lib/challenges';
import { getCollageDownload } from '@/lib/collages';
import { resizeImageBlob } from '@/lib/resize-image';
import { saveImageBlob } from '@/lib/save-image';
import { cn } from '@/lib/utils';

/** 무료 회원이 내려받기를 눌렀을 때 가는 곳 — 결제를 마치면 이 목록으로 돌아온다 */
const MEMBERSHIP_HREF = `/membership?returnTo=${encodeURIComponent('/mypage/challenges')}`;

/** 내려받기 결과 안내 — 누른 칸 아래에만 보여 준다 (목록이 길어 위에 띄우면 안 보인다) */
type Notice = { groupId: string; text: string; failed: boolean };

/** "2026년 9월 22일" — 디자인의 라벨 형식 (월·일은 0 을 채우지 않는다) */
function formatDate(iso: string | null): string {
  const date = iso ? new Date(iso) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}

/**
 * 칸마다 붙는 라벨 — 디자인은 날짜 뒤에 그 날의 몇 번째인지를 괄호로 붙인다("2026년 9월 22일(2)").
 *
 * 목록이 최신순이라 같은 날 중 위에 있는 것이 그 날의 마지막 콜라주다 — 번호를 위에서부터
 * 내려가며 매긴다. 하루가 페이지 경계에 걸치면 다음 페이지를 불러올 때 그 날의 번호가
 * 한 번 다시 매겨진다 (아래쪽 칸이 뒤늦게 도착하므로).
 */
function buildLabels(groups: ChallengeGroup[]): Map<string, string> {
  const dates = groups.map((group) => formatDate(group.completedAt ?? group.createdAt));

  const remaining = new Map<string, number>();
  for (const date of dates) remaining.set(date, (remaining.get(date) ?? 0) + 1);

  const labels = new Map<string, string>();
  groups.forEach((group, index) => {
    const date = dates[index];
    const seq = remaining.get(date) ?? 1;
    remaining.set(date, seq - 1);
    labels.set(group.id, date ? `${date}(${seq})` : '');
  });
  return labels;
}

/**
 * 완료한 챌린지 내역 — 디자인(Figma 4694:4625, 빈 화면 4694:5139)의 다크 2열 그리드.
 *
 * 칸마다 보관해 둔 콜라주를 깔고 그 위에 Download 버튼을 얹는다. **버튼은 등급과 무관하게
 * 눌린다** — 무료 회원은 내려받는 대신 회원권 구매 화면으로 보낸다(다시 받기가 유료 기능이라).
 *
 * 첫 페이지는 서버 컴포넌트가 넘겨주고, '더 보기' 는 커서로 이어 받는다
 * (offset 을 쓰면 뒤 페이지로 갈수록 느려지므로).
 */
export function ChallengeHistoryList({
  first,
  membershipActive,
}: {
  first: ChallengeHistoryPage;
  /** 화면을 열 때의 회원권 상태 — 최종 판정은 내려받기 요청을 받는 서버가 한다 */
  membershipActive: boolean;
}) {
  const router = useRouter();
  const [groups, setGroups] = useState<ChallengeGroup[]>(first.items);
  const [cursor, setCursor] = useState(first.nextCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** 지금 내려받는 중인 그룹 — 한 번에 하나만 받는다 */
  const [downloading, setDownloading] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const labels = useMemo(() => buildLabels(groups), [groups]);

  /**
   * 보관해 둔 콜라주 다시 받기 — **유료 회원 전용**이다.
   *
   * 무료 회원은 요청을 보내지 않고 바로 구매 화면으로 보낸다. 보고 있는 사이에 기간이
   * 끝났을 수도 있으므로, 서버가 403 을 주면 그때도 같은 곳으로 보낸다 — 판정은 서버가 한다.
   * 회원권이 끝나도 파일은 지우지 않으니 다시 구매하면 예전 콜라주가 그대로 돌아온다.
   */
  const downloadCollage = useCallback(
    async (groupId: string) => {
      if (!membershipActive) {
        router.push(MEMBERSHIP_HREF);
        return;
      }

      setDownloading(groupId);
      setNotice(null);
      try {
        const found = await getCollageDownload(groupId);
        if (!found.ok) {
          if (found.reason === 'membership') {
            router.push(MEMBERSHIP_HREF);
            return;
          }
          setNotice({
            groupId,
            failed: true,
            text:
              found.reason === 'missing'
                ? '보관된 콜라주가 없어요.'
                : '내려받지 못했어요. 잠시 후 다시 시도해 주세요.',
          });
          return;
        }

        // private 버킷의 짧은 signed URL — 받아서 기기에 저장한다 (앱은 사진 앱에 담는다).
        // 보관본은 템플릿 원본 해상도라, 내려줄 때 가로 1080px 로 줄인다.
        const res = await fetch(found.url, { cache: 'no-store' });
        if (!res.ok) throw new Error();

        const image = await resizeImageBlob(await res.blob());
        const saved = await saveImageBlob(image, `picky-${groupId}.png`);
        setNotice({
          groupId,
          failed: !saved.ok,
          text: saved.ok ? '사진을 저장했어요.' : saved.message,
        });
      } catch {
        setNotice({
          groupId,
          failed: true,
          text: '내려받지 못했어요. 잠시 후 다시 시도해 주세요.',
        });
      } finally {
        setDownloading(null);
      }
    },
    [membershipActive, router],
  );

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
    // 디자인의 빈 화면 — 남은 높이 위쪽에 마크와 문구만 둔다 (버튼 없음).
    // 챌린지를 시작하는 입구는 두 화면 앞의 메인이라 여기서 또 열지 않는다.
    return (
      <div className="flex flex-1 flex-col items-center gap-4 py-9 text-center">
        <SparkleMark />
        <p className="text-[16px] font-medium leading-[1.6]">
          챌린지를 하나씩 완료하고
          <br />
          Picky에 나만의 순간을 채워보세요!
        </p>
        <p className="text-[14px] leading-[1.6] text-night-sub">아직 완료한 챌린지가 없어요.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <ol className="grid grid-cols-2 gap-x-2.5 gap-y-4">
        {groups.map((group) => {
          const label = labels.get(group.id) ?? '';
          const imageUrl = group.collage?.imageUrl ?? null;
          const busy = downloading === group.id;

          return (
            <li key={group.id} className="flex flex-col gap-1">
              <div className="relative aspect-[390/692] w-full overflow-hidden bg-night-card">
                {imageUrl ? (
                  /* 짧은 signed URL 이라 next/image 로 최적화할 대상이 아니다 */
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={imageUrl}
                    alt={`${label} 콜라주`}
                    className="absolute inset-0 size-full object-cover"
                  />
                ) : (
                  // 콜라주를 만들기 전에 화면을 떠났거나 보관에 실패한 그룹 — 받을 것이 없다.
                  <p className="absolute inset-0 flex items-center justify-center px-3 text-center text-[12px] leading-[1.6] text-night-sub">
                    보관된 콜라주가 없어요
                  </p>
                )}

                {group.collage && (
                  <button
                    type="button"
                    onClick={() => void downloadCollage(group.id)}
                    disabled={busy}
                    aria-label={`${label} 콜라주 내려받기`}
                    /* 디자인의 버튼은 28px 이라 그대로 두면 터치 타깃이 작다 —
                       보이는 크기는 유지하고 가상 요소로 히트 영역만 44px 로 넓힌다. */
                    className="absolute bottom-[5%] left-1/2 flex h-7 -translate-x-1/2 items-center justify-center bg-point px-2 text-[12px] leading-none text-night before:absolute before:-inset-2 before:content-[''] active:bg-main disabled:opacity-60"
                  >
                    {busy ? 'Saving…' : 'Download'}
                  </button>
                )}
              </div>

              <p className="text-center text-[14px] leading-[1.6]">{label}</p>

              {notice?.groupId === group.id && (
                <p
                  role="status"
                  className={cn(
                    'text-center text-[12px] leading-[1.6]',
                    notice.failed ? 'text-picky-red' : 'text-night-sub',
                  )}
                >
                  {notice.text}
                </p>
              )}
            </li>
          );
        })}
      </ol>

      {error && <p className="text-center text-[12px] text-picky-red">{error}</p>}

      {cursor && (
        <button
          type="button"
          onClick={() => void loadMore()}
          disabled={loading}
          className="h-12 w-full rounded-lg border border-night-raised text-[14px] text-night-sub active:bg-night-card disabled:opacity-60"
        >
          {loading ? '불러오는 중…' : '더 보기'}
        </button>
      )}
    </div>
  );
}
