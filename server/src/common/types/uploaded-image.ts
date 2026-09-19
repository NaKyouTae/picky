/**
 * multer 메모리 스토리지가 넘겨주는 업로드 파일.
 * `@types/multer` 를 따로 받지 않기 위해 실제로 쓰는 필드만 정의한다.
 */
export interface UploadedImage {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}
