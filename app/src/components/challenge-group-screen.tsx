'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ChallengeDrawOverlay, startMinimumDraw } from '@/components/challenge-draw-overlay';
import { ChallengePhotoSheet } from '@/components/challenge-photo-sheet';
import { ChallengeProgress } from '@/components/challenge-progress';
import { Modal, type DialogState } from '@/components/modal';
import type { ChallengeProof } from '@/lib/challenge-proofs';
import { MAX_CHALLENGES_PER_GROUP, slotStatus, type ChallengeGroup } from '@/lib/challenges';
import { compressImage } from '@/lib/compress-image';
import {
  prepareRewardedAd,
  showRewardedAd,
  useIsRewardedAdAvailable,
} from '@/lib/native-app';
import { cn } from '@/lib/utils';

/**
 * 진행 중인 요청.
 *
 * 로딩 화면은 **새 챌린지를 뽑을 때만** 덮는다 — 첫 시작(홈)과 다시 뽑기다.
 * 등록하기는 어떤 결과가 나올지 이미 아는 동작이라 두구두구를 보여줄 이유가 없다.
 * 다만 버튼을 잠그는 데는 둘 다 쓰므로 상태 자체는 같이 둔다.
 */
type Pending = 'REDRAW' | 'COMPLETE' | null;

/**
 * 인증 사진 미리보기 한 장.
 *
 * 방금 올린 사진이면 objectURL(`local`), 새로고침 뒤라면 서버에서 받아 온 signed URL 이다.
 * objectURL 은 화면을 떠날 때 돌려줘야 해서 어느 쪽인지 함께 들고 다닌다.
 */
type Proof = { url: string; local: boolean };

/** 칸 번호 → 그 칸에 올린 사진. 완료한 칸도 그대로 남아 하단 번호에 썸네일로 보인다. */
type ProofsByPosition = Record<number, Proof>;

function releaseProof(proof: Proof | undefined) {
  if (proof?.local) URL.revokeObjectURL(proof.url);
}

/**
 * 진행 중인 챌린지 그룹 화면 (디자인 4605:6169).
 *
 * - **다시 뽑기**: 현재 칸의 챌린지만 교체한다 (칸 번호는 그대로).
 *   앱에서는 보상형 광고를 끝까지 봐야 교체된다 — 버튼에 '(Ad)' 를 달고 먼저 동의를 받는다
 *   (AdMob 보상형 정책: 광고임을 알리고 사용자가 스스로 고르게 해야 한다).
 * - **등록하기**: 올린 인증 사진으로 현재 챌린지를 완료하고 다음 칸을 새로 뽑는다.
 *   5번째를 완료하면 그룹이 끝나고 콜라주 화면으로 넘어간다.
 *
 * 그룹을 도중에 닫는 '그만두기' 는 이 화면에 두지 않는다 — 디자인에 없고,
 * 홈에서 같은 카테고리를 다시 고를 때 '새로 시작하기'(restart) 가 같은 일을 한다.
 */
export function ChallengeGroupScreen({ group: initialGroup }: { group: ChallengeGroup }) {
  const router = useRouter();
  /**
   * 화면에 그리는 그룹.
   * 다시 뽑기·등록하기 응답에 갱신된 그룹이 그대로 들어 있어 그것으로 바로 바꾼다.
   * `router.refresh()` 의 서버 재렌더를 기다리면 그 사이 이전 챌린지가 보이기 때문이다.
   */
  const [group, setGroup] = useState(initialGroup);
  const [pending, setPending] = useState<Pending>(null);
  /**
   * 콜라주 화면으로 넘어가는 중 (마지막 칸을 끝냈거나, 끝난 그룹에서 다시 들어갈 때).
   *
   * 등록하기에는 로딩을 두지 않지만, 화면이 통째로 바뀔 때는 덮어 준다 —
   * 그러지 않으면 콜라주가 그려질 때까지 빈 챌린지 화면이 남는다.
   * 넘어가면 이 화면이 사라지므로 따로 되돌리지 않는다.
   */
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** 업로드 중 표시 + 파일 선택창을 여는 input */
  const [uploading, setUploading] = useState(false);
  const [proofs, setProofs] = useState<ProofsByPosition>({});
  /**
   * 보고 있는 칸.
   *
   * 기본은 진행 중인 칸이고, 하단에서 끝낸 칸을 누르면 그 칸으로 옮겨 간다.
   * null 이면 '진행 중인 칸을 따라간다' 는 뜻이라, 등록해서 칸이 넘어가면 자동으로 따라붙는다.
   */
  const [viewing, setViewing] = useState<number | null>(null);
  /** 사진을 어떻게 넣을지 고르는 바텀시트 */
  const [sheet, setSheet] = useState<DialogState>('closed');
  /** 사진만 올리고 등록하지 않은 채 나가려 할 때 뜨는 확인 모달 (디자인 4636:3700) */
  const [leaving, setLeaving] = useState<DialogState>('closed');
  /**
   * 다시 뽑기 전에 광고를 볼지 묻는 모달.
   *
   * 버튼을 누르자마자 광고를 띄우면 AdMob 보상형 정책(사전 동의)에 걸린다 —
   * 무엇을 주고 무엇을 요구하는지 알린 뒤 한 번 더 고르게 하는 자리다.
   */
  const [adConsent, setAdConsent] = useState<DialogState>('closed');
  /** 광고를 불러오는 중 · 보는 중 — 그동안 버튼을 모두 잠근다 */
  const [watchingAd, setWatchingAd] = useState(false);
  // 카메라와 사진첩은 input 의 capture 속성으로 갈린다 — 둘을 따로 둔다.
  const cameraInput = useRef<HTMLInputElement>(null);
  const libraryInput = useRef<HTMLInputElement>(null);

  /**
   * 보상형 광고를 띄울 수 있는지 (= 앱 안에서 열렸는지).
   * 개발용 브라우저에는 브리지가 없어 false 이고, 그때는 광고 없이 바로 다시 뽑는다.
   */
  const adAvailable = useIsRewardedAdAvailable();

  // 아직 완료하지 않은 칸이 지금 할 챌린지다.
  const current = group.items.find((item) => item.completedAt === null);
  const completed = group.items.filter((item) => item.completedAt !== null);

  /**
   * 끝난 그룹 — 콜라주에서 뒤로 와 다시 펼쳐 본 경우다.
   * 진행 중인 칸이 없으므로 사진 올리기·다시 뽑기·등록하기를 모두 잠근다
   * (서버도 끝난 그룹은 받지 않는다). 되돌아보기 전용 화면이 된다.
   */
  const finished = group.status !== 'IN_PROGRESS';

  // 화면에 그리는 칸 — 고른 칸이 없거나 사라졌으면 진행 중인 칸으로,
  // 끝난 그룹이면 마지막 칸(5번째)으로 돌아간다.
  const viewed =
    (viewing && group.items.find((item) => item.position === viewing)) ||
    current ||
    (finished ? group.items.at(-1) : undefined);
  const position = viewed?.position;
  const proofUrl = position ? (proofs[position]?.url ?? null) : null;
  // 끝난 그룹에서는 어떤 동작도 할 수 없으므로 잠금에 함께 넣는다.
  const busy = pending !== null || uploading || watchingAd || finished;

  /**
   * 아직 주소를 모르는 사진이 있는 칸.
   *
   * 새로고침하거나 나갔다 들어오면 완료한 칸들의 사진 주소가 비어 있다.
   * 문자열로 만들어 두고 이것이 바뀔 때만 다시 받는다 (매 렌더마다 새 배열이면 계속 돈다).
   */
  const missingPositions = group.items
    .filter((item) => item.proofImagePath !== null && !proofs[item.position])
    .map((item) => item.position);
  const missingKey = missingPositions.join(',');

  /**
   * 광고를 미리 받아 둔다.
   *
   * 버튼을 누른 뒤에 받기 시작하면 광고가 뜨기까지 몇 초를 기다리게 된다.
   * 되돌아보기 전용(끝난 그룹)에는 다시 뽑기가 없으므로 받지 않는다.
   */
  useEffect(() => {
    if (adAvailable && !finished) prepareRewardedAd();
  }, [adAvailable, finished]);

  /**
   * 주소를 모르는 칸의 사진을 한 번에 받아 온다.
   * 버킷이 private 이라 짧게 만료되는 signed URL 이고, 이번 세션에서 올린 사진은
   * 이미 objectURL 을 들고 있으므로 덮어쓰지 않는다.
   */
  useEffect(() => {
    if (!missingKey) return;

    let cancelled = false;
    fetch(`/api/challenge-groups/${group.id}/proofs`, { cache: 'no-store' })
      .then((res) => (res.ok ? (res.json() as Promise<ChallengeProof[]>) : []))
      .then((fetched) => {
        if (cancelled || fetched.length === 0) return;
        setProofs((previous) => {
          const next = { ...previous };
          for (const item of fetched) {
            // 방금 올린 objectURL 이 있으면 그대로 둔다 (같은 사진인데 네트워크만 더 탄다).
            if (next[item.position]) continue;
            next[item.position] = { url: item.url, local: false };
          }
          return next;
        });
      })
      .catch(() => {
        // 미리보기를 못 받아도 화면은 그대로 쓸 수 있다 — 조용히 넘어간다.
      });

    return () => {
      cancelled = true;
    };
  }, [group.id, missingKey]);

  /** 만료로 한 번 다시 받아 본 칸 — 깨진 주소로 무한 재요청하는 것을 막는다 */
  const retriedRef = useRef<Set<number>>(new Set());

  // 남은 objectURL 은 화면을 떠날 때 한 번에 돌려준다.
  const proofsRef = useRef(proofs);
  useEffect(() => {
    proofsRef.current = proofs;
  }, [proofs]);
  useEffect(
    () => () => {
      for (const proof of Object.values(proofsRef.current)) releaseProof(proof);
    },
    [],
  );

  /**
   * signed URL 이 만료돼 이미지가 깨졌을 때 다시 받는다.
   *
   * 주소는 10분이면 만료된다. 썸네일은 유효할 때 이미 받아 브라우저 캐시에 남아 있어도,
   * 큰 사진은 칸을 옮기는 순간 새로 요청하므로 그때 만료돼 있으면 깨진다.
   *
   * 지우면 아래 '주소를 모르는 칸' 에 걸려 자동으로 새 주소를 받아 온다.
   * 같은 칸을 무한히 다시 받지 않도록, 한 번 성공적으로 뜬 뒤에만 다시 시도한다.
   */
  function handleProofError(slot: number) {
    const proof = proofs[slot];
    // 방금 올린 objectURL 은 만료 개념이 없다 — 다시 받아도 같은 결과다.
    if (!proof || proof.local || retriedRef.current.has(slot)) return;

    retriedRef.current.add(slot);
    setProofs((previous) => {
      const next = { ...previous };
      delete next[slot];
      return next;
    });
  }

  /** 새 주소로 잘 떴으면 다음 만료 때 다시 받을 수 있게 풀어 준다 */
  function handleProofLoad(slot: number) {
    retriedRef.current.delete(slot);
  }

  /**
   * 인증 사진 업로드.
   * 올리기 전에 Canvas 로 줄여 보낸다 — 휴대폰 원본은 5MB 상한을 넘기기 쉽다.
   */
  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0];
    // 같은 파일을 다시 고를 수 있도록 값을 비운다.
    event.target.value = '';
    if (!picked || !position) return;

    setUploading(true);
    setError(null);

    try {
      const file = await compressImage(picked);
      const body = new FormData();
      body.append('file', file);

      const res = await fetch(`/api/challenge-groups/${group.id}/proof?position=${position}`, {
        method: 'POST',
        body,
        cache: 'no-store',
      });
      if (!res.ok) throw new Error();

      setGroup((await res.json()) as ChallengeGroup);
      // 올린 파일을 그대로 미리보기로 쓴다 — signed URL 을 따로 받을 필요가 없다.
      setProofs((previous) => {
        // 같은 칸에 다시 올리면 이전 objectURL 은 쓸 곳이 없다.
        releaseProof(previous[position]);
        return { ...previous, [position]: { url: URL.createObjectURL(file), local: true } };
      });
    } catch {
      setError('사진을 올리지 못했어요. 다시 시도해 주세요.');
    } finally {
      setUploading(false);
    }
  }

  /**
   * 끝난 그룹에서 콜라주 화면으로 다시 들어간다.
   *
   * 콜라주에서 뒤로 오면 이 화면(되돌아보기 전용)이 뜨는데, 돌아갈 길이 없으면 홈으로
   * 나갔다가 다시 들어와야 한다. 끝난 그룹의 마지막 버튼은 그래서 콜라주로 보낸다.
   * 콜라주의 뒤로가기도 이 화면을 replace 로 열므로, 여기서도 replace 로 오가야
   * 두 화면을 왕복해도 히스토리가 쌓이지 않는다.
   */
  function goCollage() {
    // 콜라주가 그려질 때까지 빈 챌린지 화면이 남지 않도록 덮는다 (등록으로 넘어갈 때와 같다).
    setFinishing(true);
    router.replace(`/collage?group=${group.id}`);
  }

  /** 닫기는 언제나 메인으로 간다 — 브라우저 히스토리를 따라가지 않는다. */
  function goHome() {
    router.push('/');
    // 홈의 진행 배지·진행바가 지금 상태로 그려지도록 서버 컴포넌트를 다시 태운다.
    router.refresh();
  }

  /**
   * 사진만 올리고 등록하지 않았으면 먼저 확인한다 (디자인 4636:3700).
   * 올린 사진이 없으면 잃을 것이 없으므로 묻지 않고 바로 나간다.
   */
  function handleClose() {
    // 아직 등록하지 않은 칸에 사진만 올려 둔 상태인지 본다 (끝낸 칸은 이미 저장돼 있다).
    if (current?.proofImagePath) {
      setLeaving('open');
      return;
    }
    goHome();
  }

  /**
   * 바텀시트에서 고른 입력창을 연다.
   * 사용자가 누른 제스처 안에서 바로 `click()` 해야 브라우저가 카메라·사진첩을 열어 주므로,
   * 시트를 닫는 것은 그다음이다 (state 갱신을 기다리면 제스처가 끊긴다).
   */
  function openPicker(input: HTMLInputElement | null) {
    input?.click();
    setSheet('closing');
  }

  /**
   * 다시 뽑기 진입.
   *
   * 앱에서는 곧바로 뽑지 않고 광고를 볼지 먼저 묻는다 — 버튼을 누른 것만으로 광고가 뜨면
   * '사용자가 스스로 고른다' 는 보상형 광고의 전제가 깨진다.
   * 브리지가 없는 개발용 브라우저에서는 예전처럼 바로 뽑는다.
   */
  function handleRedraw() {
    if (adAvailable) {
      setAdConsent('open');
      return;
    }
    void call('REDRAW');
  }

  /**
   * 광고를 끝까지 본 뒤에만 다시 뽑는다.
   *
   * 중간에 닫았으면(`cancelled`) 아무것도 하지 않는다 — 보상형 광고는 완료한 사람에게만
   * 보상을 줘야 하고, 사용자도 왜 안 뽑혔는지 알아야 하므로 문구로 남긴다.
   */
  async function watchAdThenRedraw() {
    setAdConsent('closing');
    setError(null);
    setWatchingAd(true);

    const result = await showRewardedAd();
    if (!result.ok) {
      setWatchingAd(false);
      setError(
        result.reason === 'cancelled'
          ? '광고를 끝까지 봐야 다시 뽑을 수 있어요.'
          : '지금은 광고를 불러올 수 없어요. 잠시 후 다시 시도해 주세요.',
      );
      return;
    }

    // 로딩 화면이 끊기지 않도록 다시 뽑기가 시작된 뒤에 내린다
    // (먼저 내리면 두 상태 사이에서 오버레이가 한 프레임 깜빡인다).
    await call('REDRAW');
    setWatchingAd(false);
  }

  async function call(action: Exclude<Pending, null>) {
    if (!position) return;

    setPending(action);
    setError(null);

    // 로딩 화면을 띄우는 동작에서만 최소 노출 시간을 건다 (등록하기는 null → 즉시 통과).
    const minimumDraw = action === 'REDRAW' ? startMinimumDraw() : null;
    const path = action === 'REDRAW' ? 'redraw' : 'complete';

    try {
      const res = await fetch(`/api/challenge-groups/${group.id}/${path}?position=${position}`, {
        method: 'PATCH',
        cache: 'no-store',
      });
      if (!res.ok) throw new Error();

      const next = (await res.json()) as ChallengeGroup;

      // 등록을 마치면 언제나 진행 중인 칸으로 돌아간다.
      // (끝낸 칸을 고쳐 등록한 경우에도 마찬가지다 — null 이면 진행 중인 칸을 따라간다.)
      if (action === 'COMPLETE') setViewing(null);

      // 그룹이 끝났으면 콜라주 화면으로 넘긴다 (인증 사진을 미리 채울 수 있도록 id 를 넘긴다).
      if (next.status !== 'IN_PROGRESS') {
        setFinishing(true);
        // 등록하기로 왔으면 이 시점에 최소 노출 시간을 시작한다 (로딩이 깜빡이고 말지 않도록).
        await (minimumDraw ?? startMinimumDraw());
        router.replace(`/collage?group=${next.id}`);
        router.refresh();
        return;
      }

      // 다시 뽑기는 로딩이 덮고 있는 동안 새 내용으로 먼저 바꿔 두고 오버레이를 걷는다 —
      // 그래야 오버레이가 사라지는 순간 이미 새 챌린지가 그려져 있다.
      setGroup(next);
      await minimumDraw;
      setPending(null);
    } catch {
      setError(
        action === 'REDRAW'
          ? '다시 뽑지 못했어요. 잠시 후 시도해 주세요.'
          : '등록하지 못했어요. 잠시 후 시도해 주세요.',
      );
      setPending(null);
    }
  }

  return (
    <div
      className="flex flex-1 flex-col gap-6 bg-night px-5 font-mono text-night-text"
      // 홈과 같은 방식 — 이 화면도 다크라서 레이아웃(main)이 준 safe-top 패딩까지 끌어올려 덮는다.
      // 그렇게 하지 않으면 노치 영역만 셸의 흰 배경으로 남는다.
      // 하단 54px 은 디자인의 '홈 인디케이터 영역 34px + 그 위 여백 20px' 이다.
      style={{
        marginTop: 'calc(var(--safe-top) * -1)',
        paddingTop: 'var(--safe-top)',
        paddingBottom: 'calc(max(var(--safe-bottom), 34px) + 20px)',
      }}
    >
      {/* 화면을 닫아도 그룹은 끝나지 않는다 — 홈에서 다시 들어오면 이어서 할 수 있다 */}
      <header className="flex h-14 shrink-0 items-center justify-between">
        {/* 제목을 가운데 두기 위한 자리 — 디자인도 같은 크기의 빈 아이콘을 둔다 */}
        <span className="size-7 shrink-0" aria-hidden />

        <h1 className="text-[20px] leading-none">Challenge</h1>

        <button
          type="button"
          onClick={handleClose}
          aria-label="닫기"
          // -m-2 / p-2 로 아이콘 위치는 그대로 두고 터치 영역만 44px 로 넓힌다
          className="-m-2 p-2 text-main active:text-main/70"
        >
          <svg viewBox="0 0 28 28" fill="currentColor" className="size-7" aria-hidden>
            <path d="M22.1667 7.47833 20.5217 5.83333 14 12.355 7.47833 5.83333 5.83333 7.47833 12.355 14l-6.52167 6.5217 1.645 1.645L14 15.645l6.5217 6.5217 1.645-1.645L15.645 14l6.5217-6.52167Z" />
          </svg>
        </button>
      </header>

      <ChallengeProgress done={completed.length} className="shrink-0" />

      {/* 디자인은 칸 번호("01_")와 제목을 한 덩어리로 쌓는다 */}
      <div className="shrink-0 text-[16px] leading-[1.6]">
        <p>{String(position ?? completed.length).padStart(2, '0')}_</p>
        {viewed && <p>{viewed.challenge.title}</p>}
      </div>

      {/* 인증 사진 — 올려야 등록할 수 있다. 사진은 콜라주를 만든 뒤 지워진다. */}
      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        // capture 가 있으면 사진첩을 거치지 않고 카메라가 바로 뜬다
        capture="environment"
        onChange={(event) => void handleUpload(event)}
        className="hidden"
      />
      <input
        ref={libraryInput}
        type="file"
        accept="image/*"
        onChange={(event) => void handleUpload(event)}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => setSheet('open')}
        disabled={busy || !viewed}
        aria-label={proofUrl ? '인증 사진 다시 올리기' : '인증 사진 올리기'}
        className={cn(
          'relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-night-card',
          // 끝난 그룹에서도 잠기지만, 이 화면은 그 사진을 보러 온 것이라 흐리지 않는다.
          !finished && 'disabled:opacity-60',
        )}
      >
        {proofUrl ? (
          <>
            {/* objectURL·signed URL 이라 next/image 로 최적화할 대상이 아니다 */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={proofUrl}
              alt=""
              onError={() => position && handleProofError(position)}
              onLoad={() => position && handleProofLoad(position)}
              className="absolute inset-0 size-full object-cover"
            />
          </>
        ) : (
          <svg
            viewBox="0 0 40 40"
            fill="currentColor"
            className="size-10 text-night-sub"
            aria-hidden
          >
            <path d="M20 25.3333C22.9455 25.3333 25.3333 22.9455 25.3333 20C25.3333 17.0545 22.9455 14.6667 20 14.6667C17.0545 14.6667 14.6667 17.0545 14.6667 20C14.6667 22.9455 17.0545 25.3333 20 25.3333Z" />
            <path d="M15 3.33333L11.95 6.66667H6.66667C4.83333 6.66667 3.33333 8.16667 3.33333 10V30C3.33333 31.8333 4.83333 33.3333 6.66667 33.3333H33.3333C35.1667 33.3333 36.6667 31.8333 36.6667 30V10C36.6667 8.16667 35.1667 6.66667 33.3333 6.66667H28.05L25 3.33333H15ZM20 28.3333C15.4 28.3333 11.6667 24.6 11.6667 20C11.6667 15.4 15.4 11.6667 20 11.6667C24.6 11.6667 28.3333 15.4 28.3333 20C28.3333 24.6 24.6 28.3333 20 28.3333Z" />
          </svg>
        )}
      </button>

      {error && <p className="shrink-0 text-center text-[14px] text-[#ff8a85]">{error}</p>}

      {/* 칸 번호 — 지금 칸만 테두리로 드러내고, 끝낸 칸은 그때 올린 사진을 보여준다 */}
      <ol
        className="flex h-[62px] shrink-0 gap-2.5"
        aria-label={`${MAX_CHALLENGES_PER_GROUP}칸 중 ${position ?? completed.length}번째`}
      >
        {Array.from({ length: MAX_CHALLENGES_PER_GROUP }, (_, index) => {
          const slot = index + 1;
          const status = slotStatus(group.items, slot);
          // 끝낸 칸에만 사진을 건다 — 지금 보고 있는 칸은 위 큰 영역에서 이미 보인다.
          const thumbnail = status === 'DONE' ? proofs[slot]?.url : undefined;
          return (
            <li
              key={slot}
              className="flex flex-1"
              aria-current={slot === position ? 'step' : undefined}
            >
              <button
                type="button"
                // 아직 열리지 않은 칸은 눌러도 넘어가지 않는다.
                // 비활성으로 흐려 놓지는 않는다 — 디자인에서 다섯 칸이 같은 톤이다.
                onClick={() => status !== 'LOCKED' && setViewing(slot)}
                aria-disabled={status === 'LOCKED'}
                aria-label={`${slot}번째 챌린지${status === 'DONE' ? ' (완료)' : status === 'LOCKED' ? ' (잠김)' : ''}`}
                className={cn(
                  // 테두리는 칸마다 항상 자리를 차지한다 — 지금 칸에만 생기면 1px 만큼 흔들린다
                  'relative flex w-full items-center justify-center overflow-hidden rounded-full border bg-night-card text-[16px] leading-[1.6]',
                  slot === position ? 'border-main' : 'border-transparent',
                )}
              >
                {thumbnail ? (
                  <>
                    {/* objectURL·signed URL 이라 next/image 로 최적화할 대상이 아니다 */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={thumbnail}
                      alt=""
                      onError={() => handleProofError(slot)}
                      onLoad={() => handleProofLoad(slot)}
                      className="absolute inset-0 size-full object-cover"
                    />
                    {/* 사진이 번호를 대신하지만 몇 번째 칸인지는 읽어 줄 수 있어야 한다 */}
                    <span className="sr-only">{slot}</span>
                  </>
                ) : (
                  slot
                )}
              </button>
            </li>
          );
        })}
      </ol>

      <div className="flex shrink-0 gap-2.5">
        {/* 광고가 붙는 자리라 '(Ad)' 를 라벨에 박아 둔다 — 광고임을 숨기면
            AdMob 보상형 정책과 표시광고법(기만적 표시·광고) 양쪽에 걸린다.
            읽어 주는 이름은 무엇을 하면 무엇을 얻는지까지 풀어 준다. */}
        <button
          type="button"
          onClick={handleRedraw}
          disabled={busy || !viewed}
          aria-label={adAvailable ? '광고 보고 다시 뽑기' : undefined}
          className="h-[52px] flex-1 rounded-lg bg-night-raised text-[16px] font-medium leading-none active:bg-night-raised/70 disabled:opacity-40"
        >
          {adAvailable ? '다시 뽑기(Ad)' : '다시 뽑기'}
        </button>
        {/* 끝난 그룹에서는 등록할 것이 없으므로 같은 자리에서 콜라주로 되돌아가는 길이 된다 */}
        <button
          type="button"
          onClick={() => (finished ? goCollage() : void call('COMPLETE'))}
          disabled={finished ? finishing : busy || !viewed || !viewed.proofImagePath}
          className="h-[52px] flex-1 rounded-lg bg-point text-[16px] font-medium leading-none active:bg-point/80 disabled:opacity-40"
        >
          {finished ? '콜라주 보기' : '등록하기'}
        </button>
      </div>

      {/* 사진을 올리고 등록하지 않은 채 나가려 할 때 (디자인 4636:3700) */}
      <Modal
        state={leaving}
        onRequestClose={() => setLeaving('closing')}
        onClosed={() => setLeaving('closed')}
        labelledBy="challenge-leave-title"
        panelClassName="bg-night-card p-5 font-mono text-night-text"
        overlayClassName="bg-black/60"
        containerClassName="px-5"
      >
        {/* 디자인은 제목 없이 안내 문장 하나다 — 그 문장이 그대로 대화상자의 이름이 된다 */}
        <p
          id="challenge-leave-title"
          className="py-2 text-center text-[16px] leading-[1.6] [word-break:keep-all]"
        >
          아직 사진이 등록되지 않았어요.
          <br />
          지금 나가면 사진은 저장되지 않아요.
        </p>

        <div className="mt-6 flex gap-2.5">
          <button
            type="button"
            onClick={goHome}
            className="h-13 flex-1 rounded-lg bg-night-raised text-[16px] font-medium text-night-text active:bg-night-raised/80"
          >
            나가기
          </button>
          <button
            type="button"
            onClick={() => setLeaving('closing')}
            className="h-13 flex-1 rounded-lg bg-point text-[16px] font-medium text-night active:bg-point/80"
          >
            계속하기
          </button>
        </div>
      </Modal>

      {/* 광고를 보기 전 동의 — 보상형 광고는 '무엇을 주는지 알리고 스스로 고르게' 해야 한다 */}
      <Modal
        state={adConsent}
        onRequestClose={() => setAdConsent('closing')}
        onClosed={() => setAdConsent('closed')}
        labelledBy="challenge-ad-title"
        panelClassName="bg-night-card p-5 font-mono text-night-text"
        overlayClassName="bg-black/60"
        containerClassName="px-5"
      >
        <p
          id="challenge-ad-title"
          className="py-2 text-center text-[16px] leading-[1.6] [word-break:keep-all]"
        >
          광고를 끝까지 보면
          <br />
          챌린지를 한 번 다시 뽑을 수 있어요.
        </p>
        <p className="mt-2 text-center text-[13px] leading-[1.6] text-night-sub [word-break:keep-all]">
          중간에 닫으면 다시 뽑기가 적용되지 않아요.
        </p>

        <div className="mt-6 flex gap-2.5">
          <button
            type="button"
            onClick={() => setAdConsent('closing')}
            className="h-13 flex-1 rounded-lg bg-night-raised text-[16px] font-medium text-night-text active:bg-night-raised/80"
          >
            닫기
          </button>
          <button
            type="button"
            onClick={() => void watchAdThenRedraw()}
            className="h-13 flex-1 rounded-lg bg-point text-[16px] font-medium text-night active:bg-point/80"
          >
            광고 보기
          </button>
        </div>
      </Modal>

      <ChallengePhotoSheet
        state={sheet}
        onTakePhoto={() => openPicker(cameraInput.current)}
        onPickFromLibrary={() => openPicker(libraryInput.current)}
        onRequestClose={() => setSheet('closing')}
        onClosed={() => setSheet('closed')}
      />

      {/* 광고가 뜨기까지의 빈 시간도 같은 로더로 덮는다. 광고가 화면을 가져간 뒤에는
          이 오버레이가 그 아래에 남아, 광고를 닫는 순간 곧바로 두구두구로 이어진다. */}
      {watchingAd && pending === null && <ChallengeDrawOverlay label="광고를 불러오고 있어요" />}

      {/* 등록하기에는 로딩을 두지 않는다 — 다시 뽑기(와 홈의 첫 시작), 그리고
          마지막 칸을 끝내 콜라주로 넘어갈 때만 두구두구를 덮는다 */}
      {(pending === 'REDRAW' || finishing) && <ChallengeDrawOverlay />}
    </div>
  );
}
