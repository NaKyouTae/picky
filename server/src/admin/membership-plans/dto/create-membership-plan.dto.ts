import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/** 한 번에 팔 수 있는 최장 기간 — 오타로 100개월권이 만들어지는 것을 막는다 */
export const MAX_MONTHS = 36;

/** 금액 상한 (원) — 자릿수 실수를 걸러내기 위한 값이다 */
export const MAX_PRICE = 10_000_000;

/** 회원권 등록 — 개월 수와 금액이 핵심이고 나머지는 노출용 정보다 */
export class CreateMembershipPlanDto {
  @ApiProperty({ example: '1개월권', description: '앱 결제 화면에 보이는 이름' })
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name!: string;

  @ApiProperty({ example: 1, description: '구매 시 늘어나는 이용 기간 (개월)' })
  @IsInt()
  @Min(1)
  @Max(MAX_MONTHS)
  months!: number;

  @ApiProperty({ example: 3900, description: '판매 금액 (원)' })
  @IsInt()
  @Min(0)
  @Max(MAX_PRICE)
  price!: number;

  @ApiPropertyOptional({
    example: '유료 템플릿 무제한',
    description: '한 줄 설명. null 을 보내면 지워진다 (생략하면 기존 값을 그대로 둔다).',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string | null;

  @ApiPropertyOptional({ description: '판매 여부 — false 면 앱에 노출하지 않는다', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: '작을수록 앱에서 앞에 보인다', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;
}
