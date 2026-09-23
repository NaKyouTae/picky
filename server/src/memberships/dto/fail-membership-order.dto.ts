import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/** 결제창이 failUrl 로 실어 보내는 값 — 내역에 실패 사유를 남기기 위해 받는다 */
export class FailMembershipOrderDto {
  @ApiProperty({ description: '주문번호 (orderCode)' })
  @IsString()
  @MaxLength(64)
  orderId!: string;

  @ApiPropertyOptional({ description: '토스 실패 코드' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  code?: string;

  @ApiPropertyOptional({ description: '토스 실패 메시지' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  message?: string;
}
