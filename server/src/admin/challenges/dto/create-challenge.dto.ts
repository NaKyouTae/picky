import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { ChallengeStatus } from '../../../generated/prisma/enums';

/** 챌린지 등록 */
export class CreateChallengeDto {
  @ApiProperty({ description: '챌린지 카테고리 id (어드민에서 등록한 카테고리)' })
  @IsUUID()
  categoryId!: string;

  @ApiProperty({ example: '서로 좋아하는 영화 바꿔 시청하기' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title!: string;

  @ApiPropertyOptional({ description: '진행 방법 설명' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ example: '2시간', description: '소요 시간 안내 문구' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  duration?: string;

  @ApiPropertyOptional({ example: '🎬', description: '카드 상단 이모지' })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  emoji?: string;

  @ApiPropertyOptional({ enum: ChallengeStatus, default: ChallengeStatus.DRAFT })
  @IsOptional()
  @IsEnum(ChallengeStatus)
  status?: ChallengeStatus;
}
