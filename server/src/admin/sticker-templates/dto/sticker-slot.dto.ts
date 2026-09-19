import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, Max, Min } from 'class-validator';

/**
 * 템플릿 안의 사진 한 칸.
 *
 * 좌표·크기는 모두 템플릿 이미지 대비 **퍼센트**다. 템플릿 원본이 626×417 이든
 * 2000×1333 이든 같은 값으로 그릴 수 있어야 하기 때문에 픽셀을 쓰지 않는다.
 * 번호는 배열 순서로 정해지므로 이 DTO 에는 없다 (index 0 = 1번).
 */
export class StickerSlotDto {
  @ApiProperty({ description: '왼쪽 끝 위치 (%)', minimum: -50, maximum: 150, example: 12.5 })
  @IsNumber()
  @Min(-50)
  @Max(150)
  x!: number;

  @ApiProperty({ description: '위쪽 끝 위치 (%)', minimum: -50, maximum: 150, example: 8 })
  @IsNumber()
  @Min(-50)
  @Max(150)
  y!: number;

  @ApiProperty({ description: '가로 크기 (%)', minimum: 1, maximum: 150, example: 40 })
  @IsNumber()
  @Min(1)
  @Max(150)
  width!: number;

  @ApiProperty({ description: '세로 크기 (%)', minimum: 1, maximum: 150, example: 30 })
  @IsNumber()
  @Min(1)
  @Max(150)
  height!: number;

  @ApiPropertyOptional({ description: '기울기 (deg)', minimum: -180, maximum: 180, default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  rotation?: number;
}
