import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, MaxLength, Min } from 'class-validator';

/** 결제창이 successUrl 로 실어 보내는 값 그대로 — 서버가 주문과 대조한 뒤 토스에 승인을 요청한다 */
export class ConfirmMembershipOrderDto {
  @ApiProperty({ description: '토스 결제 키' })
  @IsString()
  @MaxLength(200)
  paymentKey!: string;

  @ApiProperty({ description: '주문번호 (주문 생성 때 받은 orderCode)' })
  @IsString()
  @MaxLength(64)
  orderId!: string;

  @ApiProperty({ description: '결제 금액 — 주문 금액과 다르면 위조로 보고 거부한다' })
  @IsInt()
  @Min(0)
  amount!: number;
}
