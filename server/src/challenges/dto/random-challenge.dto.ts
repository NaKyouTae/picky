import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ChallengeCategory } from '../../generated/prisma/enums';

/** 랜덤 챌린지 뽑기 조건 */
export class RandomChallengeDto {
  @ApiProperty({ enum: ChallengeCategory, description: '혼자 / 둘이서 / 아이랑' })
  @IsEnum(ChallengeCategory)
  category!: ChallengeCategory;

  @ApiPropertyOptional({
    description: '방금 본 챌린지 id — "다시 뽑기" 에서 같은 게 또 나오지 않도록 제외한다',
  })
  @IsOptional()
  @IsUUID()
  excludeId?: string;
}
