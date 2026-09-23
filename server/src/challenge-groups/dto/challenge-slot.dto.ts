import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { MAX_CHALLENGES_PER_GROUP } from '../challenge-groups.service';

/**
 * 어느 칸을 다룰지.
 *
 * 생략하면 진행 중인 칸이다 — 지금까지의 동작과 같다.
 * 값을 주면 **이미 열린 칸**만 가리킬 수 있다 (아직 뽑지 않은 칸은 404).
 */
export class ChallengeSlotDto {
  @ApiPropertyOptional({
    description: '칸 번호 (1..5) — 없으면 진행 중인 칸',
    minimum: 1,
    maximum: MAX_CHALLENGES_PER_GROUP,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_CHALLENGES_PER_GROUP)
  position?: number;
}
