/**
 * 콜라주에 넣을 사진 한 장.
 * 합성에는 bitmap 을, 하단 목록 썸네일에는 url 을 쓴다.
 */
export type CollagePhoto = {
  id: string;
  name: string;
  bitmap: ImageBitmap;
  width: number;
  height: number;
  /** 썸네일용 objectURL — 놓을 때 revoke 해야 한다 */
  url: string;
};

/** 합성 결과가 템플릿 해상도(≈1080px)라 한 칸은 300px 안팎이다. 원본을 그대로 들 이유가 없다. */
const MAX_EDGE = 2000;

export function releasePhoto(photo: CollagePhoto | null | undefined) {
  if (!photo) return;
  photo.bitmap.close();
  URL.revokeObjectURL(photo.url);
}

/** 기기에서 고른 사진 */
export async function loadCollagePhoto(file: File): Promise<CollagePhoto> {
  return fromBlob(file, file.name);
}

/** 챌린지 인증 사진처럼 내려받아 온 사진 */
export async function loadCollagePhotoFromBlob(blob: Blob, name: string): Promise<CollagePhoto> {
  return fromBlob(blob, name);
}

/**
 * 사진을 디코드한다.
 *
 * - `imageOrientation: 'from-image'` — iOS 사진은 회전 정보가 EXIF 에 있어 이 옵션 없이 그리면 눕는다.
 * - 긴 변을 MAX_EDGE 로 제한 — 4000×3000 다섯 장을 원본으로 들면 모바일에서 메모리로 죽는다.
 */
async function fromBlob(blob: Blob, name: string): Promise<CollagePhoto> {
  const decoded = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  const bitmap = await shrinkIfNeeded(decoded);

  return {
    id: crypto.randomUUID(),
    name,
    bitmap,
    width: bitmap.width,
    height: bitmap.height,
    url: URL.createObjectURL(blob),
  };
}

async function shrinkIfNeeded(bitmap: ImageBitmap): Promise<ImageBitmap> {
  const scale = MAX_EDGE / Math.max(bitmap.width, bitmap.height);
  if (scale >= 1) return bitmap;

  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  // Canvas 를 못 쓰는 환경이면 원본을 그대로 쓴다.
  if (!ctx) return bitmap;

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return createImageBitmap(canvas);
}
