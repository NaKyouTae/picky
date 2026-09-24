import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import { BUCKET, SupabaseService } from '../common/supabase/supabase.service';
import type { UploadedImage } from '../common/types/uploaded-image';
import type { CreateInquiryDto } from './dto/create-inquiry.dto';

/** 첨부 사진 상한 — 디자인의 칸이 3개다 (4694:5528) */
export const MAX_INQUIRY_IMAGES = 3;

/** 한 장 크기 상한. 앱이 Canvas 로 줄여 보내지만 서버가 다시 확인한다 */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const ALLOWED_IMAGE_MIME: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
};

export interface InquiryReceipt {
  id: string;
  createdAt: Date;
}

@Injectable()
export class InquiriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
  ) {}

  /**
   * 문의 접수.
   *
   * 사진을 먼저 Storage 에 올린 뒤 문의와 경로를 한 번에 저장한다 — 순서를 뒤집으면
   * 업로드가 실패했을 때 사진 없는 문의가 남는다. 반대로 이 순서에서는 DB 저장이 실패해도
   * 고아 파일만 남고 사용자에게는 실패로 보인다 (다시 보내면 온전한 문의가 만들어진다).
   */
  async create(
    userId: string,
    dto: CreateInquiryDto,
    files: UploadedImage[] = [],
  ): Promise<InquiryReceipt> {
    if (files.length > MAX_INQUIRY_IMAGES) {
      throw new BadRequestException(`사진은 최대 ${MAX_INQUIRY_IMAGES}장까지 올릴 수 있습니다.`);
    }

    // 하나라도 규격을 벗어나면 아무것도 올리지 않는다 (절반만 올라간 문의를 만들지 않도록).
    const extensions = files.map((file) => {
      const ext = ALLOWED_IMAGE_MIME[file.mimetype];
      if (!ext) throw new BadRequestException('PNG · JPG · WebP 이미지만 올릴 수 있습니다.');
      if (file.size > MAX_IMAGE_BYTES) {
        throw new BadRequestException('이미지는 5MB 이하만 올릴 수 있습니다.');
      }
      return ext;
    });

    // 문의 id 를 미리 정해 파일 경로의 앞자리로 쓴다 — 문의를 지울 때 폴더째 지울 수 있다.
    const id = randomUUID();
    // 파일명은 서버가 정한다. 원본 이름을 쓰면 경로 조작·덮어쓰기 위험이 있다.
    const paths = files.map((_, index) => `${id}/${index}-${randomUUID()}${extensions[index]}`);

    await Promise.all(
      files.map((file, index) =>
        this.supabase.uploadTo(BUCKET.inquiries, paths[index], file.buffer, file.mimetype),
      ),
    );

    try {
      return await this.prisma.inquiry.create({
        data: {
          id,
          userId,
          type: dto.type,
          content: dto.content.trim(),
          email: dto.email.trim(),
          images: {
            create: paths.map((imagePath, displayOrder) => ({ imagePath, displayOrder })),
          },
        },
        select: { id: true, createdAt: true },
      });
    } catch (error) {
      // 문의가 남지 않았으면 방금 올린 사진도 쓸 곳이 없다.
      await this.supabase.removeFrom(BUCKET.inquiries, paths);
      throw error;
    }
  }
}
