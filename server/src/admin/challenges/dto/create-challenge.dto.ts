import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ChallengeCategory, ChallengeStatus } from '../../../generated/prisma/enums';

/** 챌린지 등록 */
export class CreateChallengeDto {
  @ApiProperty({ enum: ChallengeCategory, description: '혼자 / 둘이서 / 아이랑' })
  @IsEnum(ChallengeCategory)
  category!: ChallengeCategory;

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
