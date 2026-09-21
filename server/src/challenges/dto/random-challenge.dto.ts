import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsOptional, IsUUID } from 'class-validator';

/** 랜덤 챌린지 뽑기 조건 */
export class RandomChallengeDto {
  @ApiProperty({ description: '챌린지 카테고리 id' })
  @IsUUID()
  categoryId!: string;

  @ApiPropertyOptional({
    description: '제외할 챌린지 id 들 — 그룹에 이미 담긴 챌린지는 다시 뽑히지 않게 한다',
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  // 그룹은 최대 5개라 제외 목록도 그보다 커질 일이 없다
  @ArrayMaxSize(5)
  @IsUUID('all', { each: true })
  excludeIds?: string[];
}
