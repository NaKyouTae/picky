import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { ChallengeStatus } from '../../../generated/prisma/enums';

/** 챌린지 등록·수정 — 챌린지가 갖는 값은 카테고리 · 상태 · 제목뿐이다. */
export class CreateChallengeDto {
  @ApiProperty({ description: '챌린지 카테고리 id (어드민에서 등록한 카테고리)' })
  @IsUUID()
  categoryId!: string;

  @ApiProperty({ example: '서로 좋아하는 영화 바꿔 시청하기' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title!: string;

  @ApiPropertyOptional({ enum: ChallengeStatus, default: ChallengeStatus.DRAFT })
  @IsOptional()
  @IsEnum(ChallengeStatus)
  status?: ChallengeStatus;
}
