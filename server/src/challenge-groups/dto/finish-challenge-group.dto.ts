import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

/** 진행 중인 그룹을 끝내는 방법 — 완료했거나, 완료하지 않고 그만두거나 */
export class FinishChallengeGroupDto {
  @ApiProperty({ enum: ['COMPLETED', 'ENDED'] })
  @IsIn(['COMPLETED', 'ENDED'])
  status!: 'COMPLETED' | 'ENDED';
}
