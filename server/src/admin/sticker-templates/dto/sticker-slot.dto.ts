import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Max, Min } from 'class-validator';

/**
 * 사진이 들어갈 칸 하나 — 템플릿 원본 픽셀 기준.
 *
 * 어드민의 콜라주 실험실이 계산해 보내는 값이다. 앱은 이 값을 그대로 받아
 * `translate(cx, cy) → rotate(angle) → w×h 만큼 clip` 순서로 사진을 그린다.
 */
export class StickerSlotDto {
  @ApiProperty({ description: '칸 중심 x' })
  @IsNumber()
  @Min(0)
  @Max(20000)
  cx!: number;

  @ApiProperty({ description: '칸 중심 y' })
  @IsNumber()
  @Min(0)
  @Max(20000)
  cy!: number;

  @ApiProperty({ description: '회전을 풀었을 때의 가로' })
  @IsNumber()
  @Min(1)
  @Max(20000)
  w!: number;

  @ApiProperty({ description: '회전을 풀었을 때의 세로' })
  @IsNumber()
  @Min(1)
  @Max(20000)
  h!: number;

  @ApiProperty({ description: '시계방향 라디안 (±π/2 이내)' })
  @IsNumber()
  @Min(-Math.PI / 2)
  @Max(Math.PI / 2)
  angle!: number;
}
