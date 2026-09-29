import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

/** Play 구매 토큰 길이 상한 — 실제로는 수백 자다. 말이 안 되게 큰 본문은 조회 전에 자른다. */
const MAX_PURCHASE_TOKEN_LENGTH = 2_000;

/**
 * Google Play 인앱결제 적립 — 앱이 Play Billing 에서 받은 구매를 넘긴다.
 *
 * Apple 과 달리 **서명 영수증이 아니라 토큰 하나**다. 서버가 이 토큰으로 Play Developer API 에
 * 직접 물어보므로, 상품·금액·상태는 앱이 아니라 구글에게서 받는다. 다만 조회에 상품 ID 가
 * 필요해서 함께 받는다 — 이 값이 틀리면 조회가 404 로 거절된다.
 */
export class RedeemGooglePurchaseDto {
  @ApiProperty({
    description: 'Play Console 에 등록한 인앱 상품 ID. 구매 조회에 필요하다.',
    example: 'picky_membership_1m',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  productId!: string;

  @ApiProperty({
    description: 'Play Billing 의 Purchase.getPurchaseToken(). 서버가 구글에 직접 확인한다.',
    example: 'hnbcdjkl...',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_PURCHASE_TOKEN_LENGTH)
  purchaseToken!: string;
}
