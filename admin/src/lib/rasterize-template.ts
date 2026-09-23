/**
 * 템플릿 파일을 픽셀로 바꾼다 — 검출은 픽셀을 훑어야 하므로 형식에 상관없이 한 번 래스터화한다.
 *
 * 비트맵(PNG·JPG·WebP)과 SVG 를 가는 길이 다르다:
 * - 비트맵: `createImageBitmap` 으로 바로 디코드한다.
 * - SVG: `createImageBitmap` 이 SVG 를 못 받으므로 `<img>` 로 띄운 뒤 캔버스에 그린다.
 *   벡터라 고유 크기가 없을 수도 있어서 긴 변을 정해 놓고 그 크기로 굽는다.
 */

/** SVG 를 구울 긴 변 크기 — 벡터라 확대해도 깨지지 않는다. 권장 템플릿 크기(1080×1350)에 맞춘다 */
const SVG_TARGET_LONG_EDGE = 1350;

/** 고유 크기도 viewBox 도 못 읽었을 때 쓰는 비율 (세로형) */
const FALLBACK_RATIO = 1080 / 1350;

export const SVG_MIME = 'image/svg+xml';

export type RasterizedTemplate = { width: number; height: number; data: ImageData };

export async function rasterizeTemplate(file: File): Promise<RasterizedTemplate> {
  return file.type === SVG_MIME ? rasterizeSvg(file) : rasterizeBitmap(file);
}

async function rasterizeBitmap(file: File): Promise<RasterizedTemplate> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    return draw(bitmap, bitmap.width, bitmap.height);
  } finally {
    bitmap.close();
  }
}

async function rasterizeSvg(file: File): Promise<RasterizedTemplate> {
  // viewBox 가 가장 믿을 만한 비율이다. 브라우저의 naturalWidth 는 0 이나 기본 150 이 올 수 있다.
  const ratio = readAspectRatio(await file.text());
  const url = URL.createObjectURL(file);

  try {
    const image = await loadImage(url);
    const natural =
      image.naturalWidth > 0 && image.naturalHeight > 0
        ? image.naturalWidth / image.naturalHeight
        : null;
    const aspect = ratio ?? natural ?? FALLBACK_RATIO;

    const width = Math.round(aspect >= 1 ? SVG_TARGET_LONG_EDGE : SVG_TARGET_LONG_EDGE * aspect);
    const height = Math.round(aspect >= 1 ? SVG_TARGET_LONG_EDGE / aspect : SVG_TARGET_LONG_EDGE);

    // objectURL 을 놓기 전에 그려야 한다 — 놓으면 이미지를 더 읽을 수 없다.
    return draw(image, width, height);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** 지정한 크기로 캔버스에 그리고 픽셀을 꺼낸다 */
function draw(image: CanvasImageSource, width: number, height: number): RasterizedTemplate {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('canvas 를 만들 수 없습니다.');

  ctx.drawImage(image, 0, 0, width, height);
  return { width, height, data: ctx.getImageData(0, 0, width, height) };
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('이미지를 읽지 못했습니다.'));
    image.src = url;
  });
}

/**
 * SVG 의 가로세로 비율 — `viewBox` 를 먼저 보고, 없으면 width/height 속성을 본다.
 * 둘 다 없거나 단위(%, mm 등)가 붙어 있으면 null (호출부가 다른 값으로 대체한다).
 *
 * 여는 `<svg …>` 태그 안에서만 찾는다. 문서 전체를 훑으면 도형의 `stroke-width` 같은 것이
 * 잡히고, `-width` 는 낱말 경계로도 걸러지지 않는다.
 */
export function readAspectRatio(svg: string): number | null {
  const openTag = /<svg\b[^>]*>/i.exec(svg)?.[0];
  if (!openTag) return null;

  const viewBox = /\bviewBox\s*=\s*["']\s*([-\d.eE\s,]+?)\s*["']/.exec(openTag);
  if (viewBox) {
    const parts = viewBox[1].split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) return parts[2] / parts[3];
  }

  // 단위 없는 숫자 또는 px 만 받는다. %, mm, em 등은 캔버스 크기를 정할 수 없어 무시한다.
  // 대소문자는 구분한다 — SVG 는 XML 이라 브라우저도 `Width` 를 무시하므로, 우리만 읽으면
  // 실제 렌더 크기와 어긋난다. 못 읽으면 null 로 두고 naturalWidth 를 따르는 편이 안전하다.
  const size = (name: 'width' | 'height') =>
    new RegExp(`(?<![-\\w])${name}\\s*=\\s*["']\\s*([\\d.]+)\\s*(?:px)?\\s*["']`).exec(
      openTag,
    );

  const width = size('width');
  const height = size('height');
  if (width && height) {
    const w = Number(width[1]);
    const h = Number(height[1]);
    if (w > 0 && h > 0) return w / h;
  }

  return null;
}
