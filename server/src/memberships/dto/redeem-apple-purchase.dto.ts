import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * JWS 영수증 길이 상한 — 실제로는 2~4KB 수준이다.
 * 검증은 서명 확인이라 비용이 있으므로, 말이 안 되게 큰 본문은 파싱 전에 자른다.
 */
const MAX_SIGNED_TRANSACTION_LENGTH = 20_000;

/** App Store 인앱결제 적립 — 앱이 StoreKit 에서 받은 영수증을 그대로 넘긴다 */
export class RedeemApplePurchaseDto {
  @ApiProperty({
    description:
      'StoreKit 의 VerificationResult 에서 꺼낸 서명 거래 영수증(JWS). 서버가 Apple 루트 인증서까지 검증한다.',
    example: 'eyJhbGciOiJFUzI1NiIsIng1YyI6W...',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_SIGNED_TRANSACTION_LENGTH)
  signedTransactionInfo!: string;
}
