import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SupabaseService } from '../../common/supabase/supabase.service';
import type { UploadedImage } from '../../common/types/uploaded-image';
import type { Prisma } from '../../generated/prisma/client';
import type { StickerTemplateStatus } from '../../generated/prisma/enums';
import {
  normalizeSlots,
  readSlots,
  type StickerSlot,
} from '../../sticker-templates/sticker-slot';
import type { CreateStickerTemplateDto } from './dto/create-sticker-template.dto';
import type { ListAdminStickerTemplatesDto } from './dto/list-admin-sticker-templates.dto';
import type { UpdateStickerTemplateDto } from './dto/update-sticker-template.dto';

const DEFAULT_TAKE = 20;

/** 템플릿 이미지를 모아 두는 Storage 디렉터리 — 업로드/삭제 모두 이 아래로만 허용한다 */
const IMAGE_DIR = 'sticker-templates';

/** 투명 배경(사진 자리)이 필요하므로 PNG 를 권장하지만 JPEG/WebP 도 받는다 */
const ALLOWED_MIME: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
};

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export interface AdminStickerTemplateRow {
  id: string;
  title: string;
  status: StickerTemplateStatus;
  imageUrl: string;
  imagePath: string;
  imageWidth: number;
  imageHeight: number;
  slots: StickerSlot[];
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminStickerTemplatePage {
  items: AdminStickerTemplateRow[];
  /** 다음 페이지 요청에 그대로 넘길 커서. null 이면 마지막 페이지 */
  nextCursor: string | null;
}

/** 목록/단건 모두 같은 형태로 내려주기 위한 공통 select */
const TEMPLATE_SELECT = {
  id: true,
  title: true,
  status: true,
  imageUrl: true,
  imagePath: true,
  imageWidth: true,
  imageHeight: true,
  slots: true,
  displayOrder: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class AdminStickerTemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
  ) {}

  /** 템플릿 이미지를 Storage 에 올리고 경로와 미리보기 URL 을 돌려준다 */
  async uploadImage(file: UploadedImage | undefined): Promise<{ path: string; url: string }> {
    if (!file) throw new BadRequestException('이미지 파일이 필요합니다.');

    const ext = ALLOWED_MIME[file.mimetype];
    if (!ext) {
      throw new BadRequestException('PNG · JPG · WebP 이미지만 올릴 수 있습니다.');
    }
    if (file.size > MAX_IMAGE_BYTES) {
      throw new BadRequestException('이미지는 5MB 이하만 올릴 수 있습니다.');
    }

    // 파일명은 서버가 정한다 — 원본 이름을 쓰면 경로 조작·덮어쓰기 위험이 있다.
    const path = `${IMAGE_DIR}/${randomUUID()}${ext}`;
    const url = await this.supabase.upload(path, file.buffer, file.mimetype);
    return { path, url };
  }

  /**
   * 템플릿 목록 (커서 기반).
   * 정렬은 createdAt 역순 + id 보조 키. 상태 필터는 `@@index([status, createdAt])` 가 커버한다.
   */
  async list({
    q,
    status,
    cursor,
    take = DEFAULT_TAKE,
  }: ListAdminStickerTemplatesDto): Promise<AdminStickerTemplatePage> {
    const where = {
      ...(status ? { status } : {}),
      // 부분 일치라 btree 인덱스를 타지 않는다. 데이터가 커지면 pg_trgm GIN 을 고려할 것.
      ...(q ? { title: { contains: q, mode: 'insensitive' as const } } : {}),
    };

    const rows = await this.prisma.stickerTemplate.findMany({
      where,
      // 한 건 더 읽어 다음 페이지 존재 여부를 판단한다 (별도 count 쿼리 없이).
      take: take + 1,
      // skip: 1 은 offset 페이징이 아니라 커서 행 자체를 제외하기 위한 것이다.
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: TEMPLATE_SELECT,
    });

    const hasNext = rows.length > take;
    const page = hasNext ? rows.slice(0, take) : rows;
    const items = page.map((row) => ({ ...row, slots: readSlots(row.slots) }));

    return { items, nextCursor: hasNext ? (items.at(-1)?.id ?? null) : null };
  }

  async get(id: string): Promise<AdminStickerTemplateRow> {
    const template = await this.prisma.stickerTemplate.findUnique({
      where: { id },
      select: TEMPLATE_SELECT,
    });
    if (!template) throw new NotFoundException('스티커 템플릿을 찾을 수 없습니다.');
    return { ...template, slots: readSlots(template.slots) };
  }

  async create(dto: CreateStickerTemplateDto): Promise<AdminStickerTemplateRow> {
    const created = await this.prisma.stickerTemplate.create({
      data: {
        title: dto.title,
        status: dto.status,
        imagePath: assertImagePath(dto.imagePath),
        // 공개 URL 은 클라이언트가 보낸 값을 믿지 않고 경로에서 직접 만든다.
        imageUrl: this.supabase.getPublicUrl(dto.imagePath),
        imageWidth: dto.imageWidth,
        imageHeight: dto.imageHeight,
        slots: toSlotsJson(dto.slots),
        displayOrder: dto.displayOrder,
      },
      select: TEMPLATE_SELECT,
    });
    return { ...created, slots: readSlots(created.slots) };
  }

  async update(id: string, dto: UpdateStickerTemplateDto): Promise<AdminStickerTemplateRow> {
    // 존재하지 않는 id 를 Prisma 오류(P2025) 대신 404 로 돌려준다.
    const current = await this.get(id);

    const nextPath = dto.imagePath ? assertImagePath(dto.imagePath) : undefined;
    const replacingImage = Boolean(nextPath && nextPath !== current.imagePath);

    const updated = await this.prisma.stickerTemplate.update({
      where: { id },
      data: {
        title: dto.title,
        status: dto.status,
        ...(nextPath ? { imagePath: nextPath, imageUrl: this.supabase.getPublicUrl(nextPath) } : {}),
        imageWidth: dto.imageWidth,
        imageHeight: dto.imageHeight,
        ...(dto.slots ? { slots: toSlotsJson(dto.slots) } : {}),
        displayOrder: dto.displayOrder,
      },
      select: TEMPLATE_SELECT,
    });

    // 이미지를 교체했으면 이전 파일은 더 이상 참조되지 않는다. 실패해도 저장은 유효하므로
    // SupabaseService 가 로그만 남기고 삼킨다.
    if (replacingImage) await this.supabase.remove([current.imagePath]);

    return { ...updated, slots: readSlots(updated.slots) };
  }

  async remove(id: string): Promise<void> {
    const template = await this.get(id);
    await this.prisma.stickerTemplate.delete({ where: { id } });
    await this.supabase.remove([template.imagePath]);
  }
}

/**
 * Prisma 의 Json 입력 타입은 인덱스 시그니처를 요구해서 구조체 배열이 그대로 들어가지 않는다.
 * 정규화까지 마친 값이므로 여기서 한 번만 넓혀 준다.
 */
function toSlotsJson(slots: Parameters<typeof normalizeSlots>[0]): Prisma.InputJsonValue {
  return normalizeSlots(slots) as unknown as Prisma.InputJsonValue;
}

/** 업로드 API 가 만든 경로만 받는다 — 다른 디렉터리의 파일을 가리키거나 지우지 못하도록 */
function assertImagePath(path: string): string {
  if (!path.startsWith(`${IMAGE_DIR}/`) || path.includes('..') || extname(path) === '') {
    throw new BadRequestException('이미지를 다시 업로드해 주세요.');
  }
  return path;
}
