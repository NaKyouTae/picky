import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { StickerTemplateStatus } from '../../../generated/prisma/enums';

/** 관리자 스티커 템플릿 목록 조회 조건 (커서 기반 페이지네이션) */
export class ListAdminStickerTemplatesDto {
  @ApiPropertyOptional({ description: '제목 부분 검색어' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ enum: StickerTemplateStatus, description: '상태 필터' })
  @IsOptional()
  @IsEnum(StickerTemplateStatus)
  status?: StickerTemplateStatus;

  @ApiPropertyOptional({ description: '이전 응답의 nextCursor (마지막 행의 id)' })
  @IsOptional()
  @IsUUID()
  cursor?: string;

  @ApiPropertyOptional({ description: '한 페이지 크기', default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number;
}
