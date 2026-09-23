import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { StickerTemplateStatus } from '../../../generated/prisma/enums';
import { StickerSlotDto } from './sticker-slot.dto';

/**
 * 콜라주 템플릿 등록 — 이미지 한 장 + 사진이 들어갈 칸 목록.
 *
 * 칸은 어드민 콜라주 실험실에서 계산해 보낸다 (검정 영역 검출 또는 프레임 생성).
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

  @ApiPropertyOptional({
    description:
      '고객에게 보여 줄 미리보기 이미지의 Storage 경로. 합성용 레이어는 칸이 뚫려 있어 ' +
      '칸이 화면 전체인 템플릿은 전부 투명하게 보이므로, 칸을 채운 그림을 따로 올려 둔다.',
    example: 'sticker-templates/7b1f…-preview.png',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  previewImagePath?: string;

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

  @ApiProperty({
    description: '사진이 들어갈 칸 — 템플릿 원본 픽셀 기준',
    type: [StickerSlotDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  // 한 콜라주에 넣을 사진 수의 현실적인 상한
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => StickerSlotDto)
  slots!: StickerSlotDto[];

  @ApiPropertyOptional({ enum: StickerTemplateStatus, default: StickerTemplateStatus.DRAFT })
  @IsOptional()
  @IsEnum(StickerTemplateStatus)
  status?: StickerTemplateStatus;

  @ApiPropertyOptional({
    description: '유료 템플릿 여부. 생략하면 무료(false)로 등록된다.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isPaid?: boolean;
}
