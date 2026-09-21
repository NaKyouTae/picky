import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { ChallengeStatus } from '../../../generated/prisma/enums';

/** 챌린지 카테고리 등록 */
export class CreateChallengeCategoryDto {
  @ApiProperty({ example: '둘이서', description: '앱에 보이는 이름' })
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  name!: string;

  @ApiPropertyOptional({ example: '💞', description: '카드 위 이모지' })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  emoji?: string;

  @ApiPropertyOptional({ example: '늘 하던 데이트 말고', description: '한 줄 설명' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  description?: string;

  @ApiPropertyOptional({ description: '작을수록 앱에서 앞에 보인다', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @ApiPropertyOptional({ enum: ChallengeStatus, default: ChallengeStatus.PUBLISHED })
  @IsOptional()
  @IsEnum(ChallengeStatus)
  status?: ChallengeStatus;
}
