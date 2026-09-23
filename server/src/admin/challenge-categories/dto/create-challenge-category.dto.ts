import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { ChallengeStatus } from '../../../generated/prisma/enums';

/**
 * 챌린지 카테고리 등록·수정.
 *
 * 비울 수 있는 칸은 `null` 을 받는다 — 수정에서 생략(`undefined`)은 "그대로 두기" 라,
 * 지우려면 명시적으로 null 을 보내야 한다.
 */
export class CreateChallengeCategoryDto {
  @ApiProperty({ example: '둘이서', description: '앱에 보이는 이름' })
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  name!: string;

  @ApiPropertyOptional({ example: '💞', description: '카드 위 이모지 (null 이면 지운다)' })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  emoji?: string | null;

  @ApiPropertyOptional({
    example: '늘 하던 데이트 말고',
    description: '한 줄 설명 (null 이면 지운다)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  description?: string | null;

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
