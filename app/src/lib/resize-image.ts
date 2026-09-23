'use client';

/**
 * 보관본을 다시 받을 때 맞추는 가로 폭.
 * 완성본은 템플릿 원본 해상도(보통 이보다 크다)라 그대로 주면 몇 MB 짜리 PNG 가 내려간다.
 */
export const COLLAGE_DOWNLOAD_WIDTH = 1080;

/** blob 을 <img> 로 읽어 들인다 (objectURL 이라 canvas 가 오염되지 않는다) */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('image decode failed'));
    image.src = src;
  });
}

/**
 * 이미지를 가로 `width` 에 맞춰 줄인다 (비율 유지).
 *
 * **늘리지는 않는다** — 원본이 이미 좁으면 그대로 돌려준다. 없는 화소를 만들어 봐야
 * 파일만 커지고 그림은 흐려진다.
 */
export async function resizeImageBlob(blob: Blob, width = COLLAGE_DOWNLOAD_WIDTH): Promise<Blob> {
  const src = URL.createObjectURL(blob);
  try {
    const image = await loadImage(src);
    if (!image.naturalWidth || image.naturalWidth <= width) return blob;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = Math.round((image.naturalHeight * width) / image.naturalWidth);

    const ctx = canvas.getContext('2d');
    if (!ctx) return blob;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    const resized = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/png'),
    );
    return resized ?? blob;
  } catch {
    // 줄이지 못했다고 저장까지 막지는 않는다 — 원본을 그대로 넘긴다.
    return blob;
  } finally {
    URL.revokeObjectURL(src);
  }
}
