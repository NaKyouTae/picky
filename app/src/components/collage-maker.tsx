'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CollageTemplateSheet } from '@/components/collage-template-sheet';
import type { DialogState } from '@/components/modal';
import type { ChallengeProof } from '@/lib/challenge-proofs';
import type { CollageTemplate } from '@/lib/collage-templates';
import {
  // loadCollagePhoto — 기기에서 고른 파일을 읽는 함수. 사진 추가 버튼과 함께 잠들어 있다.
  loadCollagePhotoFromBlob,
  releasePhoto,
  type CollagePhoto,
} from '@/lib/collage-photo';
import { keepCollage } from '@/lib/collages';
import { saveImageBlob } from '@/lib/save-image';
import { cn } from '@/lib/utils';
import { coverCrop, drawCollage, type SlotFill } from '@picky/collage';

/** 미리보기 캔버스 가로 — 셸(390px) 의 2배를 넘어 고해상도 화면에서도 선명하다 */
const PREVIEW_WIDTH = 860;

export function CollageMaker({
  templates,
  proofs,
  groupId,
  hasMembership,
  membershipHref,
  backHref,
}: {
  templates: CollageTemplate[];
  /** 완료한 챌린지의 인증 사진 — 화면을 열 때 순서대로 채운다 */
  proofs: ChallengeProof[];
  /**
   * 이 콜라주를 만든 챌린지 그룹 — 보관함의 키다 (그룹당 한 장).
   * null 이면(직접 들어온 경우) 보관하지 않는다. 어느 챌린지의 결과물인지 알 수 없어서다.
   */
  groupId: string | null;
  /**
   * 회원권이 살아 있으면 유료 템플릿도 쓸 수 있다.
   * 완성본 보관은 등급을 가리지 않는다 — 다시 받을 때만 회원권을 본다('완료한 챌린지').
   */
  hasMembership: boolean;
  /** 잠긴 템플릿을 눌렀을 때 갈 구매 화면 — 결제 후 이 화면으로 돌아오도록 경로를 달고 있다 */
  membershipHref: string;
  /**
   * 뒤로가기로 갈 곳 — 챌린지를 끝내고 온 경우의 마지막(5번째) 챌린지 화면이다.
   * null 이면(직접 들어온 경우) 브라우저 히스토리를 따라간다.
   */
  backHref: string | null;
}) {
  const router = useRouter();
  // 잠긴 유료 템플릿이 처음부터 선택돼 있으면 시트에서 다시 고를 수 없으므로
  // (잠긴 카드는 구매 화면으로 보낸다) 지금 쓸 수 있는 첫 템플릿으로 시작한다.
  const [templateId, setTemplateId] = useState(
    templates.find((item) => hasMembership || !item.isPaid)?.id ?? null,
  );
  const [photos, setPhotos] = useState<CollagePhoto[]>([]);
  const [sheet, setSheet] = useState<DialogState>('closed');
  const [error, setError] = useState<string | null>(null);
  // 사진 추가 버튼을 감추면서 함께 잠든 상태 — 버튼을 되살릴 때 같이 푼다.
  // const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  /** 공유를 쓸 수 없는 브라우저용 폴백 — 결과 이미지를 띄워 저장하게 한다 */
  const [result, setResult] = useState<string | null>(null);
  /** 인증 사진을 불러오는 중 */
  const [loadingProofs, setLoadingProofs] = useState(proofs.length > 0);
  /** 실패가 아닌 안내 (칸이 찼다 등) — 오류와 색을 구분한다 */
  const [notice, setNotice] = useState<string | null>(null);
  /** 끌고 있는 사진 — null 이면 끄는 중이 아니다 */
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const previewCanvas = useRef<HTMLCanvasElement>(null);
  /** 썸네일 줄 — 끌어 옮길 때 포인터 위치를 칸 번호로 바꾸는 기준이 된다 */
  const thumbRow = useRef<HTMLDivElement>(null);
  // const fileInput = useRef<HTMLInputElement>(null);

  const template = useMemo(
    () => templates.find((item) => item.id === templateId) ?? null,
    [templates, templateId],
  );

  /** 이 템플릿에 들어가는 사진 수 — 업로드 상한이기도 하다 */
  const slotCount = template?.slots.length ?? 0;

  // 템플릿 이미지 비트맵 — 합성할 때 사진 위에 덮는 레이어
  const [layer, setLayer] = useState<ImageBitmap | null>(null);
  const layerRef = useRef<ImageBitmap | null>(null);
  useEffect(() => {
    layerRef.current = layer;
  }, [layer]);

  // 언마운트 시 비트맵·objectURL 을 놓아준다
  const photosRef = useRef<CollagePhoto[]>([]);
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);
  useEffect(
    () => () => {
      photosRef.current.forEach(releasePhoto);
      layerRef.current?.close();
    },
    [],
  );
  useEffect(() => {
    if (!result) return;
    return () => URL.revokeObjectURL(result);
  }, [result]);

  // 안내·오류 모두 띄워서 보여 주므로(디자인에 자리가 없다) 스스로 사라지게 한다.
  // 남아 있으면 버튼을 가린 채 화면에 눌어붙는다. 오류는 읽을 시간을 조금 더 준다.
  useEffect(() => {
    if (!notice && !error) return;
    const timer = setTimeout(
      () => {
        setNotice(null);
        setError(null);
      },
      error ? 4000 : 2500,
    );
    return () => clearTimeout(timer);
  }, [notice, error]);

  // 인증 사진을 순서대로 채운다. 한 번만 돌면 되므로 의존성을 비워 둔다.
  useEffect(() => {
    if (proofs.length === 0) return;
    let alive = true;

    void (async () => {
      try {
        // position 오름차순으로 오지만, 순서가 곧 칸 번호라 한 번 더 확실히 맞춘다
        const ordered = [...proofs].sort((a, b) => a.position - b.position);
        const loaded = await Promise.all(
          ordered.map(async (proof) => {
            // private 버킷의 signed URL — CORS 가 열려 있어야 캔버스에 그릴 수 있다
            const res = await fetch(proof.url, { mode: 'cors', cache: 'no-store' });
            if (!res.ok) throw new Error('proof fetch failed');
            return loadCollagePhotoFromBlob(await res.blob(), `${proof.position}번째 인증`);
          }),
        );

        if (!alive) {
          loaded.forEach(releasePhoto);
          return;
        }
        setPhotos(loaded);
      } catch {
        if (alive) setError('인증 사진을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
      } finally {
        if (alive) setLoadingProofs(false);
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!template) return;
    let alive = true;

    void (async () => {
      try {
        // Storage 의 public URL 이라 CORS 가 열려 있어야 캔버스에 그린 뒤 저장할 수 있다.
        const res = await fetch(template.imageUrl, { mode: 'cors', cache: 'force-cache' });
        if (!res.ok) throw new Error('template fetch failed');
        const bitmap = await createImageBitmap(await res.blob());

        if (!alive) {
          bitmap.close();
          return;
        }
        const previous = layerRef.current;
        setLayer(bitmap);
        previous?.close();
      } catch {
        if (alive) setError('템플릿을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
      }
    })();

    return () => {
      alive = false;
    };
  }, [template]);

  /** 사진은 목록 순서대로 1번 칸부터 들어간다 */
  const fills = useMemo<(SlotFill | null)[]>(() => {
    if (!template) return [];
    return template.slots.map((slot, index) => {
      const photo = photos[index];
      if (!photo) return null;
      return {
        photo: photo.bitmap,
        photoW: photo.width,
        photoH: photo.height,
        crop: coverCrop(slot.w, slot.h, photo.width, photo.height),
      };
    });
  }, [template, photos]);

  useEffect(() => {
    const canvas = previewCanvas.current;
    if (!canvas || !template || !layer) return;

    const scale = Math.min(1, PREVIEW_WIDTH / template.imageWidth);
    canvas.width = Math.round(template.imageWidth * scale);
    canvas.height = Math.round(template.imageHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    drawCollage(
      ctx,
      layer,
      template.imageWidth,
      template.imageHeight,
      template.slots,
      fills,
      scale,
    );
  }, [template, layer, fills]);

  /* 기기에서 사진을 직접 고르는 경로 — 버튼과 함께 잠들어 있다.
  const addPhotos = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      // 칸 수를 넘겨 받으면 넣을 자리가 없어 메모리만 쓴다. 남은 자리만큼만 디코드한다.
      const remaining = slotCount - photosRef.current.length;
      if (remaining <= 0) {
        setNotice(`이 템플릿은 ${slotCount}칸이에요. 사진을 빼고 다시 넣어 주세요.`);
        return;
      }

      const picked = Array.from(files).slice(0, remaining);
      const dropped = files.length - picked.length;

      setBusy(true);
      setError(null);
      if (dropped > 0) {
        setNotice(`남은 자리가 ${remaining}칸이라 ${picked.length}장만 넣었어요.`);
      }
      try {
        const loaded = await Promise.all(picked.map(loadCollagePhoto));
        setPhotos((current) => [...current, ...loaded]);
      } catch {
        setError('사진을 불러오지 못했어요.');
      } finally {
        setBusy(false);
      }
    },
    [slotCount],
  );
  */

  /** 목록에서 한 장을 다른 자리로 옮긴다 */
  const reorder = useCallback((id: string, to: number) => {
    setPhotos((current) => {
      const from = current.findIndex((photo) => photo.id === id);
      if (from < 0 || from === to || to < 0 || to >= current.length) return current;

      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }, []);

  /**
   * 포인터 x 좌표가 몇 번째 칸 위인지.
   * 칸이 같은 폭으로 늘어서 있어 위치만으로 구한다 (gap-2.5 = 10px 까지 셈에 넣는다).
   */
  const indexAt = useCallback(
    (clientX: number) => {
      const row = thumbRow.current;
      if (!row || photos.length === 0) return 0;

      const rect = row.getBoundingClientRect();
      const gap = 10;
      const cell = (rect.width - gap * (photos.length - 1)) / photos.length;
      const raw = Math.floor((clientX - rect.left) / (cell + gap));
      return Math.min(photos.length - 1, Math.max(0, raw));
    },
    [photos.length],
  );

  /**
   * 끌어서 순서 바꾸기 — 끄는 동안 목록을 바로 바꿔서 미리보기도 함께 따라온다.
   *
   * 포인터 이벤트만 쓴다: HTML5 드래그앤드롭은 모바일에서 동작하지 않고,
   * 이것 하나 때문에 드래그 라이브러리를 들이지는 않는다.
   *
   * **리스너를 끌고 있는 칸이 아니라 window 에 단다.** 칸에 setPointerCapture 를 걸면
   * 순서가 바뀔 때 React 가 그 DOM 노드를 옮기는데(insertBefore), 노드가 분리·재삽입되는
   * 순간 캡처가 풀려 첫 교체 이후로 추적이 끊긴다.
   */
  useEffect(() => {
    if (!draggingId) return;

    const onMove = (event: PointerEvent) => reorder(draggingId, indexAt(event.clientX));
    const onEnd = () => setDraggingId(null);

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
    };
  }, [draggingId, reorder, indexAt]);

  /**
   * 완성본을 PNG 로 뽑는다.
   * 미리보기는 축소본이지만 여기서는 템플릿 원본 해상도로 그린다
   * (crop 이 비율값이라 같은 fills 를 그대로 쓴다).
   */
  async function renderBlob(): Promise<Blob> {
    if (!template || !layer) throw new Error('template not ready');

    const canvas = document.createElement('canvas');
    canvas.width = template.imageWidth;
    canvas.height = template.imageHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas unavailable');

    drawCollage(ctx, layer, template.imageWidth, template.imageHeight, template.slots, fills, 1);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('encode failed');
    return blob;
  }

  /** 공유 — 모바일 웹에서 사진앱까지 이어지는 경로는 공유가 가장 확실하다 */
  async function share() {
    if (!canExport || saving) return;
    setSaving(true);
    setError(null);

    try {
      const blob = await renderBlob();
      const file = new File([blob], `picky-${Date.now()}.png`, { type: 'image/png' });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: '내 콜라주' });
        return;
      }

      // 공유를 못 쓰면 결과를 띄워 두고 직접 저장하게 한다 (iOS 는 길게 눌러 저장).
      setResult(URL.createObjectURL(blob));
    } catch (cause) {
      // 공유 시트를 사용자가 닫은 것은 오류가 아니다.
      if (cause instanceof DOMException && cause.name === 'AbortError') return;
      setError('공유하지 못했어요. 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  }

  /**
   * 내려받기 — 공유를 쓸 수 없는 브라우저의 폴백 경로다 (아래 result 오버레이).
   *
   * 기기에 저장하고 보관함에도 같은 이미지를 올린다. 보관은 기다리지 않는다 —
   * 저장은 이미 끝났고 업로드는 몇 MB 라, 그동안 버튼을 잡아 두면 저장이 안 된 것처럼 보인다.
   */
  async function download(): Promise<boolean> {
    if (!canExport || saving) return false;
    setSaving(true);
    setError(null);

    try {
      const blob = await renderBlob();

      const saved = await saveImageBlob(blob, `picky-${Date.now()}.png`);
      if (!saved.ok) {
        setError(saved.message);
        return false;
      }
      setNotice('사진을 저장했어요.');

      // 그룹당 한 장이라 '콜라주 완성' 으로 이미 올렸더라도 덮어쓸 뿐이다.
      if (groupId) {
        void keepCollage(groupId, blob).catch(() =>
          setNotice('보관함에 담지 못했어요. 다시 내려받으면 담깁니다.'),
        );
      }
      return true;
    } catch {
      setError('저장하지 못했어요. 다시 시도해 주세요.');
      return false;
    } finally {
      setSaving(false);
    }
  }

  /**
   * 콜라주 완성 — 보관함에 올리고, 기기에 내려받고, 메인으로 돌아간다 (디자인 4636:4014).
   *
   * **보관을 먼저 한다.** 기기에 먼저 저장하면 보관이 실패했을 때 다시 눌러야 하는데,
   * 그러면 사진첩에 같은 그림이 두 장 남는다. 보관은 그룹당 한 장이라 다시 눌러도 덮어쓴다.
   *
   * 회원 등급을 가리지 않고 모두 보관한다 — 나중에 '완료한 챌린지' 에서 다시 받을 때만
   * 회원권을 확인한다(서버). 무료 사용자도 지금 이 자리에서는 자기 콜라주를 받아 간다.
   *
   * 실패하면 화면에 남아 다시 누를 수 있게 한다. 넘어가 버리면 이 화면의 사진은
   * 브라우저 메모리에만 있어서 되돌아와도 비어 있다.
   */
  async function complete() {
    if (!canExport || saving) return;
    setSaving(true);
    setError(null);

    try {
      const blob = await renderBlob();

      if (groupId) await keepCollage(groupId, blob);

      const saved = await saveImageBlob(blob, `picky-${Date.now()}.png`);
      if (!saved.ok) {
        setError(saved.message);
        return;
      }

      // replace 로 나간다 — 뒤로 가도 이 화면으로 돌아오지 않게 (사진이 이미 비어 있다).
      router.replace('/');
    } catch {
      setError('저장하지 못했어요. 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  }

  const filled = fills.filter(Boolean).length;
  /** 내보낼 수 있는 상태인지 — 템플릿·레이어가 준비되고 사진이 한 장이라도 들어갔을 때 */
  const canExport = Boolean(template) && Boolean(layer) && filled > 0;
  /** 칸을 다 채웠는지 — 더 넣을 자리가 없다 */
  // const full = slotCount > 0 && photos.length >= slotCount;

  // 다크 화면이라 레이아웃(main)이 준 safe-top 패딩까지 끌어올려 덮는다.
  // 그렇게 하지 않으면 노치 영역만 셸의 흰 배경으로 남는다.
  // 하단 여백은 다른 화면과 같은 --page-bottom 이다 (홈 인디케이터 위 20px).
  const shellStyle = {
    // 셸과 같은 높이로 못 박는다. main 은 min-h-full 이라 높이가 auto 라서, 높이를 주지
    // 않으면 캔버스의 고유 크기(템플릿 원본 비율)가 그대로 화면을 넘겨 스크롤이 생긴다.
    // 높이가 정해져야 아래 미리보기의 flex-1 이 '남은 높이' 로 계산된다.
    height: 'var(--app-h, 100dvh)',
    marginTop: 'calc(var(--safe-top) * -1)',
    paddingTop: 'var(--safe-top)',
    paddingBottom: 'var(--page-bottom)',
  } as const;

  if (templates.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center bg-night px-5 text-center font-mono text-night-text"
        style={shellStyle}
      >
        <p className="text-base font-medium">아직 콜라주 템플릿이 없어요</p>
        <p className="mt-2 text-sm text-night-sub">템플릿이 준비되면 여기서 만들 수 있어요.</p>
        <Link
          href="/"
          className="mt-6 flex h-[52px] w-full items-center justify-center rounded-lg bg-point text-[16px] font-medium text-night active:bg-main"
        >
          홈으로
        </Link>
      </div>
    );
  }

  return (
    // 디자인(Figma "콜라주" 4636:3982) — 헤더·미리보기·썸네일·버튼을 24px 간격으로 쌓는다.
    <div
      className="flex min-h-0 flex-col items-center gap-6 bg-night px-5 font-mono text-night-text"
      style={shellStyle}
    >
      {/* 헤더 — 제목은 가운데, 액션은 양 끝에 겹쳐 둔다 */}
      <header className="relative flex h-14 w-full items-center">
        <h1 className="flex-1 text-center text-[20px] leading-none">Collage</h1>

        <button
          type="button"
          // replace 로 돌아간다 — 챌린지 화면도 replace 로 덮고 온 자리라 히스토리가 늘지 않는다.
          onClick={() => (backHref ? router.replace(backHref) : router.back())}
          aria-label="뒤로가기"
          className="absolute left-0 flex size-7 items-center justify-center active:opacity-60"
        >
          <Image src="/arrow-back.svg" alt="" width={28} height={28} unoptimized />
        </button>

        {/* 내려받기는 아래 '콜라주 완성' 버튼으로 옮겼다 — 헤더에는 공유만 남는다 (디자인 4650:4245) */}
        <button
          type="button"
          onClick={() => void share()}
          disabled={!canExport || saving}
          aria-label="콜라주 공유하기"
          className="absolute right-0 flex size-7 items-center justify-center active:opacity-60 disabled:opacity-40"
        >
          <Image src="/share.svg" alt="" width={19} height={20} unoptimized />
        </button>
      </header>

      {/* 미리보기 — 디자인(4636:3996)의 309x548(= 세로 9:16) 회색 판.
          가로를 남은 높이에서 비율로 정하므로(h-full + aspect) 화면이 짧으면 판째로 작아진다.
          템플릿은 아무리 길어도 이 안에 제 비율대로 줄어 들어간다 (canvas 의 max-w/max-h).
          min-h-0 이 없으면 flex 항목의 기본 min-height:auto 때문에 캔버스의 고유 높이
          아래로 줄어들지 못해 화면을 넘긴다. */}
      <div className="flex w-full min-h-0 flex-1 items-center justify-center">
        <div className="flex aspect-[9/16] h-full max-w-full items-center justify-center overflow-hidden bg-night-card">
          <canvas ref={previewCanvas} className="block max-h-full max-w-full" />
        </div>
      </div>

      {/* 넣은 사진 — 순서가 곧 칸 번호다. 끌어서 바꿀 수 있다 */}
      <div ref={thumbRow} className="flex h-[62px] w-full gap-2.5">
        {loadingProofs
          ? Array.from({ length: proofs.length }, (_, index) => (
              <div key={index} className="flex-1 animate-pulse rounded-full bg-night-card" />
            ))
          : photos.map((photo, index) => (
              <button
                key={photo.id}
                type="button"
                // 시작만 여기서 받고, 움직임·놓기는 window 리스너가 맡는다 (위 useEffect)
                onPointerDown={() => setDraggingId(photo.id)}
                // 끌 때 브라우저가 스크롤·확대를 가져가지 않도록 제스처를 우리가 받는다
                style={{ touchAction: 'none' }}
                // 끌기를 못 쓰는 환경(키보드)에서도 순서를 바꿀 수 있어야 한다
                onKeyDown={(event) => {
                  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
                  event.preventDefault();
                  reorder(photo.id, index + (event.key === 'ArrowLeft' ? -1 : 1));
                }}
                aria-label={`${index + 1}번째 사진 — 끌거나 좌우 방향키로 순서를 바꿀 수 있어요`}
                className={cn(
                  'relative flex flex-1 items-center justify-center overflow-hidden rounded-full bg-night-card',
                  'transition-transform',
                  // 칸보다 사진이 많으면 뒤쪽은 들어가지 않는다 — 흐리게 해서 구분한다
                  index >= slotCount && 'opacity-40',
                  // 끌고 있는 칸은 살짝 들어 올려 어느 것을 쥐고 있는지 보이게 한다
                  draggingId === photo.id && 'z-10 scale-110 ring-2 ring-point',
                )}
              >
                {/* 로컬 objectURL 이라 next/image 로 최적화할 대상이 아니다 */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.url}
                  alt=""
                  draggable={false}
                  className="pointer-events-none absolute inset-0 size-full object-cover"
                />
                <span className="pointer-events-none relative text-[16px] leading-[1.6]">
                  {index + 1}
                </span>
              </button>
            ))}
      </div>

      {/* 액션 */}
      <div className="flex w-full gap-2.5">
        <button
          type="button"
          onClick={() => setSheet('open')}
          className="flex h-[52px] flex-1 items-center justify-center rounded-lg bg-night-raised px-5 text-[16px] font-medium text-night-text active:opacity-80"
        >
          템플릿 선택
        </button>

        <button
          type="button"
          onClick={() => void complete()}
          disabled={!canExport || saving}
          className="flex h-[52px] flex-1 items-center justify-center gap-2.5 rounded-lg bg-point px-5 text-[16px] font-medium text-night active:bg-main disabled:opacity-40"
        >
          {/* 초록 버튼 위라 아이콘도 어두운 색이다 (헤더용 연두 아이콘과 파일이 다르다) */}
          <Image src="/download-night.svg" alt="" width={20} height={20} unoptimized />
          {saving ? '저장 중…' : '콜라주 완성'}
        </button>
      </div>

      <CollageTemplateSheet
        state={sheet}
        templates={templates}
        hasMembership={hasMembership}
        membershipHref={membershipHref}
        selectedId={templateId}
        onSelect={(id) => {
          setTemplateId(id);
          setSheet('closing');
        }}
        onRequestClose={() => setSheet('closing')}
        onClosed={() => setSheet('closed')}
      />

      {/* 안내·오류는 레이아웃을 밀지 않도록 띄워서 보여 준다 (디자인에 자리가 없다) */}
      {(error ?? notice) && (
        <div
          role="status"
          className="fixed left-1/2 z-50 -translate-x-1/2 rounded-full bg-night-raised px-4 py-2 text-[13px] text-night-text"
          style={{ bottom: 'calc(var(--safe-bottom) + 96px)' }}
        >
          {error ?? notice}
        </div>
      )}

      {/* 공유를 못 쓰는 브라우저 폴백 */}
      {result && (
        <div className="fixed inset-0 z-50 flex flex-col bg-night/95 px-5 py-6">
          <p className="text-center text-sm">
            이미지를 길게 눌러 저장하거나, 아래 버튼으로 내려받으세요.
          </p>
          <div className="flex flex-1 items-center justify-center py-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={result} alt="완성된 콜라주" className="max-h-full w-full object-contain" />
          </div>
          {/* 앵커의 download 속성은 WKWebView 에서 무시된다 — 저장은 download() 한 경로로만 부른다 */}
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              void download().then((ok) => {
                if (ok) setResult(null);
              });
            }}
            className="flex h-[52px] w-full items-center justify-center rounded-lg bg-point text-[16px] font-medium text-night disabled:opacity-60"
          >
            내려받기
          </button>
          <button
            type="button"
            onClick={() => setResult(null)}
            className="mt-2 h-11 w-full text-sm font-medium text-night-sub"
          >
            닫기
          </button>
        </div>
      )}
    </div>
  );
}
