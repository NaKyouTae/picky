import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import { BUCKET, SupabaseService } from '../common/supabase/supabase.service';
import type { UploadedImage } from '../common/types/uploaded-image';
import { MembershipsService } from '../memberships/memberships.service';

/**
 * 완성본은 템플릿 원본 해상도의 PNG 라 인증 사진(5MB)보다 크다 — 넉넉히 잡는다.
 * 컨트롤러의 multer 상한과 같은 값이어야 한다.
 */
export const MAX_COLLAGE_BYTES = 10 * 1024 * 1024;

const ALLOWED_COLLAGE_MIME: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
};

const COLLAGE_SELECT = {
  id: true,
  groupId: true,
  byteSize: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * 완성한 콜라주 보관함.
 *
 * **보관은 모두에게 열려 있고, 다시 받는 것만 유료다.** 콜라주를 완성하면 등급을 가리지 않고
 * 여기에 남는다 — 무료 사용자도 그 자리에서는 자기 콜라주를 받아 가기 때문이다.
 * 대신 나중에 '완료한 챌린지' 에서 다시 받으려면 그 시점에 회원권이 살아 있어야 한다.
 *
 * 기간이 끝나도 파일은 지우지 않는다. 그래서 다시 구매하면 예전 콜라주가 그대로 돌아온다.
 */
@Injectable()
export class CollagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
    private readonly memberships: MembershipsService,
  ) {}

  /**
   * 콜라주 보관 — 앱이 '콜라주 완성' 에서 완성본을 올린다. **회원 등급을 가리지 않는다.**
   *
   * 그룹당 한 장이라 다시 올리면 갈아 끼우고 이전 파일은 버린다.
   * 새 파일을 먼저 올린 뒤에 이전 것을 지운다 — 순서를 바꾸면 업로드가 실패했을 때
   * 보관본이 통째로 사라진다.
   */
  async save(userId: string, groupId: string, file: UploadedImage | undefined) {
    if (!file) throw new BadRequestException('이미지 파일이 필요합니다.');

    const ext = ALLOWED_COLLAGE_MIME[file.mimetype];
    if (!ext) throw new BadRequestException('PNG · JPG 이미지만 보관할 수 있습니다.');
    if (file.size > MAX_COLLAGE_BYTES) {
      throw new BadRequestException('이미지는 10MB 이하만 보관할 수 있습니다.');
    }

    // 남의 그룹으로 보관하지 못하도록 userId 까지 조건에 넣는다.
    const group = await this.prisma.challengeGroup.findFirst({
      where: { id: groupId, userId },
      select: { id: true },
    });
    if (!group) throw new NotFoundException('챌린지 그룹을 찾을 수 없습니다.');

    const previous = await this.prisma.collage.findUnique({
      where: { groupId },
      select: { imagePath: true },
    });

    // 파일명은 서버가 정한다 — 원본 이름을 쓰면 경로 조작·덮어쓰기 위험이 있다.
    const path = `${userId}/${groupId}-${randomUUID()}${ext}`;
    await this.supabase.uploadTo(BUCKET.collages, path, file.buffer, file.mimetype);

    const collage = await this.prisma.collage.upsert({
      where: { groupId },
      create: { userId, groupId, imagePath: path, byteSize: file.size },
      update: { imagePath: path, byteSize: file.size },
      select: COLLAGE_SELECT,
    });

    if (previous && previous.imagePath !== path) {
      await this.supabase.removeFrom(BUCKET.collages, [previous.imagePath]);
    }

    return collage;
  }

  /**
   * 다시 내려받기 — private 버킷이라 짧은 signed URL 을 그때그때 발급한다.
   *
   * **유료 회원만 받을 수 있다.** 보관은 누구나 하지만 다시 꺼내는 것은 회원권 기능이라,
   * 기간이 끝났으면 받을 수 없고 다시 구매해야 열린다 (파일은 그대로 남아 있다).
   */
  async downloadUrl(userId: string, groupId: string) {
    await this.memberships.assertActive(userId);

    const collage = await this.prisma.collage.findFirst({
      where: { groupId, userId },
      select: { imagePath: true, createdAt: true },
    });
    if (!collage) throw new NotFoundException('보관된 콜라주가 없습니다.');

    return {
      url: await this.supabase.createSignedUrl(BUCKET.collages, collage.imagePath),
      createdAt: collage.createdAt,
    };
  }
}
