/**
 * 템플릿 안의 사진 한 칸 — DB 에는 `sticker_templates.slots` JSON 배열로 들어간다.
 * 배열 순서가 곧 사진 번호(index 0 = 1번)이므로 번호는 따로 저장하지 않는다.
 */
export interface StickerSlot {
  /** 왼쪽 끝 위치 (템플릿 가로 대비 %) */
  x: number;
  /** 위쪽 끝 위치 (템플릿 세로 대비 %) */
  y: number;
  /** 가로 크기 (%) */
  width: number;
  /** 세로 크기 (%) */
  height: number;
  /** 기울기 (deg) */
  rotation: number;
}

/** 저장할 때 쓰는 정규화 — rotation 기본값 0 을 채우고 필요한 키만 남긴다 */
export function normalizeSlots(
  slots: { x: number; y: number; width: number; height: number; rotation?: number }[],
): StickerSlot[] {
  return slots.map((slot) => ({
    x: slot.x,
    y: slot.y,
    width: slot.width,
    height: slot.height,
    rotation: slot.rotation ?? 0,
  }));
}

/**
 * DB 의 Json 컬럼을 슬롯 배열로 읽는다.
 * 쓰기는 항상 normalizeSlots 를 거치지만, 컬럼 타입이 Json 이라 읽을 때는
 * 형태를 보장할 수 없으므로 깨진 행이 응답에 섞이지 않도록 걸러 준다.
 */
export function readSlots(value: unknown): StickerSlot[] {
  if (!Array.isArray(value)) return [];

  return value.filter(isStickerSlot).map((slot) => ({
    x: slot.x,
    y: slot.y,
    width: slot.width,
    height: slot.height,
    rotation: slot.rotation ?? 0,
  }));
}

function isStickerSlot(value: unknown): value is StickerSlot & { rotation?: number } {
  if (typeof value !== 'object' || value === null) return false;
  const slot = value as Record<string, unknown>;
  return (['x', 'y', 'width', 'height'] as const).every(
    (key) => typeof slot[key] === 'number' && Number.isFinite(slot[key]),
  );
}
