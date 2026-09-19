import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
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

/** 한 템플릿에 넣을 수 있는 사진 칸 수 — 앱에서 한 번에 고르게 할 현실적인 상한 */
export const MAX_SLOTS = 12;

/** 스티커 템플릿 등록 */
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

  @ApiProperty({
    type: [StickerSlotDto],
    description: '사진 칸 목록. 배열 순서가 곧 사진 번호(1번부터)다.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_SLOTS)
  @ValidateNested({ each: true })
  @Type(() => StickerSlotDto)
  slots!: StickerSlotDto[];

  @ApiPropertyOptional({ description: '앱 목록 정렬 (작을수록 앞)', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  displayOrder?: number;

  @ApiPropertyOptional({ enum: StickerTemplateStatus, default: StickerTemplateStatus.DRAFT })
  @IsOptional()
  @IsEnum(StickerTemplateStatus)
  status?: StickerTemplateStatus;
}
