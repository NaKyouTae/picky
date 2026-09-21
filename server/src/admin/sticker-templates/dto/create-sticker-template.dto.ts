import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { StickerTemplateStatus } from '../../../generated/prisma/enums';

/**
 * 스티커 템플릿 등록 — 템플릿은 이미지 한 장이 전부다.
 * 노출 순서(displayOrder)는 목록에서 드래그로 정하므로 여기서 받지 않는다 (새 템플릿은 맨 뒤).
 */
export class CreateStickerTemplateDto {
  @ApiProperty({ example: '폴라로이드 4컷' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title!: string;

  @ApiProperty({
    description: '업로드 API 가 돌려준 Storage 경로. public URL 은 서버가 이 경로로 만든다.',
    example: 'sticker-templates/7b1f….png',
  })
  @IsString()
  @MaxLength(500)
  imagePath!: string;

  @ApiProperty({ description: '템플릿 원본 가로 픽셀', example: 626 })
  @IsInt()
  @Min(1)
  @Max(20000)
  imageWidth!: number;

  @ApiProperty({ description: '템플릿 원본 세로 픽셀', example: 417 })
  @IsInt()
  @Min(1)
  @Max(20000)
  imageHeight!: number;

  @ApiPropertyOptional({ enum: StickerTemplateStatus, default: StickerTemplateStatus.DRAFT })
  @IsOptional()
  @IsEnum(StickerTemplateStatus)
  status?: StickerTemplateStatus;
}
