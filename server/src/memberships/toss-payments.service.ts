import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const CONFIRM_URL = 'https://api.tosspayments.com/v1/payments/confirm';

/** 승인 응답에서 우리가 쓰는 필드만 골라 둔다 (전체 Payment 객체는 훨씬 크다) */
export interface TossPayment {
  paymentKey: string;
  orderId: string;
  status: string;
  totalAmount: number;
  /** '카드' · '간편결제' 처럼 한글 표기로 온다 */
  method?: string;
  approvedAt?: string;
}

/** 토스가 4xx 로 알려주는 실패 — code/message 를 그대로 사용자에게 보여 준다 */
export class TossPaymentError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/**
 * 토스페이먼츠 코어 API 클라이언트.
 *
 * 시크릿 키는 서버에만 두고, 승인은 반드시 서버에서 호출한다 —
 * 결제창이 알려주는 결제 결과만으로는 결제가 확정되지 않는다.
 */
@Injectable()
export class TossPaymentsService {
  private readonly logger = new Logger(TossPaymentsService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * 결제 승인. 실패하면 {@link TossPaymentError} 를 던진다.
   *
   * `Idempotency-Key` 에 주문번호를 실어 같은 주문이 두 번 승인되지 않게 한다
   * (성공 화면을 새로고침하거나 네트워크 재시도가 겹칠 수 있다).
   */
  async confirm(params: {
    paymentKey: string;
    orderId: string;
    amount: number;
  }): Promise<TossPayment> {
    const secretKey = this.config.get<string>('TOSS_SECRET_KEY');
    if (!secretKey) {
      this.logger.error('TOSS_SECRET_KEY 가 없어 결제를 승인할 수 없습니다.');
      throw new ServiceUnavailableException('결제 설정이 준비되지 않았습니다.');
    }

    // 토스는 비밀번호 없는 Basic 인증을 쓴다 — 시크릿 키 뒤에 콜론을 붙여 인코딩한다.
    const authorization = `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`;

    const res = await fetch(CONFIRM_URL, {
      method: 'POST',
      headers: {
        authorization,
        'Content-Type': 'application/json',
        'Idempotency-Key': params.orderId,
      },
      body: JSON.stringify(params),
    }).catch((error: unknown) => {
      this.logger.error(`토스 승인 요청 실패: ${String(error)}`);
      throw new ServiceUnavailableException('결제 서버와 통신할 수 없습니다.');
    });

    const body = (await res.json().catch(() => null)) as
      (TossPayment & { code?: string; message?: string }) | null;

    if (!res.ok || !body?.paymentKey) {
      const code = body?.code ?? `HTTP_${res.status}`;
      const message = body?.message ?? '결제 승인에 실패했습니다.';
      this.logger.warn(`토스 승인 거절 (${code}): ${message}`);
      throw new TossPaymentError(code, message);
    }

    return body;
  }
}
