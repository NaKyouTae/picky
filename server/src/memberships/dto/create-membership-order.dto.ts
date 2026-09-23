import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

/** 결제창을 띄우기 전에 주문을 만든다 — 금액은 서버가 플랜에서 읽는다(클라이언트 값을 믿지 않는다) */
export class CreateMembershipOrderDto {
  @ApiProperty({ description: '구매할 회원권 id' })
  @IsUUID()
  planId!: string;
}
