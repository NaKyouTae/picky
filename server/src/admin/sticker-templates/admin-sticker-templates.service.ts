import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SupabaseService } from '../../common/supabase/supabase.service';
import type { UploadedImage } from '../../common/types/uploaded-image';
import type { StickerTemplateStatus } from '../../generated/prisma/enums';
import type { CreateStickerTemplateDto } from './dto/create-sticker-template.dto';
import type { StickerSlotDto } from './dto/sticker-slot.dto';
import type { ListAdminStickerTemplatesDto } from './dto/list-admin-sticker-templates.dto';
import type { ReorderStickerTemplatesDto } from './dto/reorder-sticker-templates.dto';
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
  /** 고객용 미리보기 — 없으면 imageUrl 로 대신한다 */
  previewImageUrl: string | null;
  previewImagePath: string | null;
  imageWidth: number;
  imageHeight: number;
  slots: unknown;
  slotCount: number;
  isPaid: boolean;
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
  previewImageUrl: true,
  previewImagePath: true,
  imageWidth: true,
  imageHeight: true,
  slots: true,
  slotCount: true,
  isPaid: true,
  displayOrder: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * slots 와 slotCount 를 함께 만든다.
 * 길이를 따로 저장하므로 한쪽만 바꾸면 목록의 칸 수가 거짓이 된다 — 늘 같이 쓴다.
 */
function slotFields(slots: StickerSlotDto[]) {
  return {
    // 좌표만 남긴다 — DTO 인스턴스를 그대로 넣으면 다른 필드가 JSON 에 섞일 수 있다.
    slots: slots.map(({ cx, cy, w, h, angle }) => ({ cx, cy, w, h, angle })),
    slotCount: slots.length,
  };
}

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
   *
   * 정렬은 앱과 같은 displayOrder 오름차순 — 어드민이 드래그로 만든 순서가
   * 그대로 앱 스티커 시트의 순서라서, 목록도 같은 순서로 보여야 한다.
   * displayOrder 는 중복될 수 있으므로 커서가 흔들리지 않게 id 를 마지막 보조 키로 둔다.
   * `@@index([status, displayOrder, createdAt])` 가 필터와 정렬을 커버한다.
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
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      select: TEMPLATE_SELECT,
    });

    const hasNext = rows.length > take;
    const items = hasNext ? rows.slice(0, take) : rows;

    return { items, nextCursor: hasNext ? (items.at(-1)?.id ?? null) : null };
  }

  async get(id: string): Promise<AdminStickerTemplateRow> {
    const template = await this.prisma.stickerTemplate.findUnique({
      where: { id },
      select: TEMPLATE_SELECT,
    });
    if (!template) throw new NotFoundException('스티커 템플릿을 찾을 수 없습니다.');
    return template;
  }

  /** 새 템플릿은 목록 맨 뒤에 붙인다 — 순서는 이후 드래그로 바꾼다 */
  async create(dto: CreateStickerTemplateDto): Promise<AdminStickerTemplateRow> {
    const last = await this.prisma.stickerTemplate.aggregate({ _max: { displayOrder: true } });

    return this.prisma.stickerTemplate.create({
      data: {
        title: dto.title,
        status: dto.status,
        imagePath: assertImagePath(dto.imagePath),
        // 공개 URL 은 클라이언트가 보낸 값을 믿지 않고 경로에서 직접 만든다.
        imageUrl: this.supabase.getPublicUrl(dto.imagePath),
        ...previewFields(dto.previewImagePath, (path) => this.supabase.getPublicUrl(path)),
        imageWidth: dto.imageWidth,
        imageHeight: dto.imageHeight,
        ...slotFields(dto.slots),
        isPaid: dto.isPaid,
        displayOrder: (last._max.displayOrder ?? -1) + 1,
      },
      select: TEMPLATE_SELECT,
    });
  }

  async update(id: string, dto: UpdateStickerTemplateDto): Promise<AdminStickerTemplateRow> {
    // 존재하지 않는 id 를 Prisma 오류(P2025) 대신 404 로 돌려준다.
    const current = await this.get(id);

    const nextPath = dto.imagePath ? assertImagePath(dto.imagePath) : undefined;
    const replacingImage = Boolean(nextPath && nextPath !== current.imagePath);

    const nextPreview = dto.previewImagePath ? assertImagePath(dto.previewImagePath) : undefined;
    const replacingPreview = Boolean(nextPreview && nextPreview !== current.previewImagePath);

    const updated = await this.prisma.stickerTemplate.update({
      where: { id },
      data: {
        title: dto.title,
        status: dto.status,
        ...(nextPath
          ? { imagePath: nextPath, imageUrl: this.supabase.getPublicUrl(nextPath) }
          : {}),
        ...previewFields(nextPreview, (path) => this.supabase.getPublicUrl(path)),
        imageWidth: dto.imageWidth,
        imageHeight: dto.imageHeight,
        ...(dto.slots ? slotFields(dto.slots) : {}),
        isPaid: dto.isPaid,
      },
      select: TEMPLATE_SELECT,
    });

    // 이미지를 교체했으면 이전 파일은 더 이상 참조되지 않는다. 실패해도 저장은 유효하므로
    // SupabaseService 가 로그만 남기고 삼킨다.
    const stale = [
      ...(replacingImage ? [current.imagePath] : []),
      ...(replacingPreview && current.previewImagePath ? [current.previewImagePath] : []),
    ];
    if (stale.length > 0) await this.supabase.remove(stale);

    return updated;
  }

  /**
   * 목록 순서 변경 — 받은 배열 순서대로 displayOrder 를 0,1,2… 로 다시 매긴다.
   *
   * 일부만 보내면 보내지 않은 행과 번호가 겹쳐 순서가 뒤엉키므로 전체 목록을 받는다.
   * 여러 행을 한 번에 바꾸므로 트랜잭션으로 묶어 중간 상태가 보이지 않게 한다.
   */
  async reorder({ ids }: ReorderStickerTemplatesDto): Promise<void> {
    // 없는 id 가 섞여 있으면 update 가 P2025 로 터지므로 미리 막는다.
    const found = await this.prisma.stickerTemplate.count({ where: { id: { in: ids } } });
    if (found !== ids.length) {
      throw new NotFoundException('목록이 바뀌었습니다. 새로고침 후 다시 시도해 주세요.');
    }

    await this.prisma.$transaction(
      ids.map((id, index) =>
        this.prisma.stickerTemplate.update({ where: { id }, data: { displayOrder: index } }),
      ),
    );
  }

  async remove(id: string): Promise<void> {
    const template = await this.get(id);
    await this.prisma.stickerTemplate.delete({ where: { id } });
    await this.supabase.remove(
      [template.imagePath, template.previewImagePath].filter((path): path is string => !!path),
    );
  }
}

/**
 * 고객용 미리보기 경로·URL 을 함께 만든다 (경로를 보내지 않았으면 건드리지 않는다).
 * URL 은 클라이언트가 보낸 값을 믿지 않고 경로에서 직접 만든다 — imageUrl 과 같은 규칙이다.
 */
function previewFields(path: string | undefined, toUrl: (path: string) => string) {
  if (!path) return {};
  const safe = assertImagePath(path);
  return { previewImagePath: safe, previewImageUrl: toUrl(safe) };
}

/** 업로드 API 가 만든 경로만 받는다 — 다른 디렉터리의 파일을 가리키거나 지우지 못하도록 */
function assertImagePath(path: string): string {
  if (!path.startsWith(`${IMAGE_DIR}/`) || path.includes('..') || extname(path) === '') {
    throw new BadRequestException('이미지를 다시 업로드해 주세요.');
  }
  return path;
}
