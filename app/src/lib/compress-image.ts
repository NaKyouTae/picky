/**
 * 업로드 전 이미지 축소·재인코딩.
 *
 * 인증 사진은 콜라주 한 칸에 들어갈 용도라 원본 해상도가 필요하지 않다.
 * 요즘 휴대폰 사진은 한 장에 4~8MB 라서 그대로 올리면 업로드가 느리고
 * 서버 상한(5MB)에도 걸린다. 긴 변을 맞춰 줄이고 JPEG 으로 다시 굽는다.
 *
 * 라이브러리 없이 Canvas 로 처리한다 (앱 의존성을 늘리지 않기 위해).
 */
const MAX_EDGE = 1600;
const QUALITY = 0.8;

export async function compressImage(file: File): Promise<File> {
  // 이미 충분히 작고 JPEG 이면 그대로 쓴다.
  if (file.type === 'image/jpeg' && file.size <= 600 * 1024) return file;

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    // Canvas 를 못 쓰는 환경이면 원본을 그대로 올린다 (서버가 크기를 다시 검사한다).
    return file;
  }

  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', QUALITY),
  );
  if (!blob) return file;

  return new File([blob], replaceExtension(file.name), { type: 'image/jpeg' });
}

function replaceExtension(name: string): string {
  const base = name.replace(/\.[^.]+$/, '');
  return `${base || 'proof'}.jpg`;
}
