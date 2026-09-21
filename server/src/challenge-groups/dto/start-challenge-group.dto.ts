import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

/**
 * 챌린지 그룹 시작 요청.
 * 카테고리만 받는다 — 어떤 챌린지가 담길지는 서버가 그 안에서 랜덤으로 뽑는다.
 * (카테고리를 고르는 것이 곧 그룹 생성이다)
 */
export class StartChallengeGroupDto {
  @ApiProperty({ description: '챌린지 카테고리 id' })
  @IsUUID()
  categoryId!: string;

  @ApiPropertyOptional({
    description:
      '이미 진행 중인 그룹이 있어도 그것을 종료(ENDED)하고 새로 시작한다. ' +
      '기본값(false)이면 진행 중인 그룹이 있을 때 409 를 반환한다.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  restart?: boolean;
}
