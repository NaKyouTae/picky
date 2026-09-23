import { Injectable, Logger, ServiceUnavailableException, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  Environment,
  SignedDataVerifier,
  VerificationException,
  VerificationStatus,
  type ResponseBodyV2DecodedPayload,
} from '@apple/app-store-server-library';

/**
 * Apple 루트 인증서 — JWS 서명 체인의 최종 신뢰 지점이다.
 *
 * 공개 인증서라 저장소에 함께 둔다(만료 2039-04). `nest-cli.json` 의 assets 설정이
 * 빌드 때 dist 로 복사하므로 개발·운영 모두 이 상대 경로로 찾을 수 있다.
 */
const ROOT_CERT_FILE = 'AppleRootCA-G3.cer';

/** 검증을 마친 App Store 거래 — 우리가 쓰는 값만 추린다 */
export interface VerifiedAppleTransaction {
  /** 이 구매 한 건의 고유 ID — 중복 적립을 막는 멱등 키다 */
  transactionId: string;
  /** 같은 상품 계열의 첫 거래 ID — 환불 조회 때 Apple 이 쓰는 기준값 */
  originalTransactionId: string;
  /** App Store Connect 에 등록한 상품 ID — 우리 플랜과 이어 준다 */
  productId: string;
  purchasedAt: Date;
  /** Sandbox(심사·TestFlight) 인지 Production 인지 */
  environment: Environment;
  /** 실제 청구 금액 (원 단위). 영수증이 알려 주지 않거나 원화가 아니면 null */
  amount: number | null;
  /** 환불·취소된 시각. 유효한 거래면 null */
  revokedAt: Date | null;
}

/** 검증 거절 — 사용자에게 보여 줄 수 있는 사유다 (TossPaymentError 와 같은 역할) */
export class AppleIapError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/**
 * App Store 인앱결제 영수증 검증.
 *
 * 앱이 StoreKit 에서 받은 서명 영수증(JWS)을 그대로 넘기면, 이 서비스가 Apple 루트
 * 인증서까지 서명 체인을 확인하고 payload 를 돌려준다. **앱이 보낸 상품 ID·구매 여부를
 * 그대로 믿지 않는다** — 탈옥 기기나 프록시로 위조한 값이 올 수 있기 때문이다.
 *
 * 검증기는 환경별로 따로 만들어야 한다. Sandbox 영수증을 Production 검증기에 넣으면
 * 환경 불일치로 거절되는데, **심사원과 TestFlight 는 항상 Sandbox 로 산다.** 그래서
 * 두 환경을 순서대로 시도한다 — 운영 결제가 대부분이라 Production 을 먼저 본다.
 */
@Injectable()
export class AppleIapService implements OnModuleInit {
  private readonly logger = new Logger(AppleIapService.name);

  /** 시도 순서대로 담는다. 설정이 없으면 비어 있고, 그때는 결제를 받지 않는다. */
  private verifiers: SignedDataVerifier[] = [];

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const bundleId = this.config.get<string>('APPLE_BUNDLE_ID');
    if (!bundleId) {
      this.logger.warn('APPLE_BUNDLE_ID 가 없어 인앱결제 검증을 비활성화합니다.');
      return;
    }

    const rootCertificates = [readFileSync(join(__dirname, 'certs', ROOT_CERT_FILE))];

    // appAppleId 는 Production 검증기에만 필요하다 (라이브러리가 없으면 생성자에서 던진다).
    // App Store Connect 의 앱 정보 > 일반 정보 > Apple ID 값이다.
    const appAppleId = Number(this.config.get<string>('APPLE_APP_APPLE_ID')) || undefined;
    if (appAppleId) {
      this.verifiers.push(
        // enableOnlineChecks: 인증서 폐기(OCSP)와 만료를 실제로 확인한다.
        // 검증을 건너뛰면 폐기된 중간 인증서로 서명한 위조 영수증을 통과시키게 된다.
        new SignedDataVerifier(
          rootCertificates,
          true,
          Environment.PRODUCTION,
          bundleId,
          appAppleId,
        ),
      );
    } else {
      this.logger.warn('APPLE_APP_APPLE_ID 가 없어 Sandbox 결제만 받습니다.');
    }

    this.verifiers.push(
      new SignedDataVerifier(rootCertificates, true, Environment.SANDBOX, bundleId),
    );
  }

  /**
   * 서명 영수증을 검증해 거래 정보를 돌려준다.
   *
   * @throws {AppleIapError} 위조·환불·형식 오류 등 사용자에게 알려 줄 수 있는 거절
   * @throws {ServiceUnavailableException} 서버에 검증 설정이 없는 경우
   */
  async verifyTransaction(signedTransactionInfo: string): Promise<VerifiedAppleTransaction> {
    if (this.verifiers.length === 0) {
      this.logger.error('인앱결제 검증 설정이 없어 영수증을 확인할 수 없습니다.');
      throw new ServiceUnavailableException('결제 설정이 준비되지 않았습니다.');
    }

    const transaction = await this.decodeTransaction(signedTransactionInfo);

    // 이미 환불·취소된 거래로는 기간을 주지 않는다. 앱이 오래된 영수증을 다시 보낼 수 있다.
    if (transaction.revokedAt) {
      throw new AppleIapError('REVOKED_TRANSACTION', '이미 환불된 결제입니다.');
    }

    return transaction;
  }

  /**
   * 서명 영수증을 검증해 그대로 돌려준다 — **환불된 거래도 거부하지 않는다.**
   *
   * 환불 알림(App Store Server Notifications)이 넘겨주는 영수증은 당연히 환불 표시가 붙어
   * 있으므로, 구매 경로({@link verifyTransaction})와 달리 그 이유로 막으면 안 된다.
   */
  async decodeTransaction(signedTransactionInfo: string): Promise<VerifiedAppleTransaction> {
    if (this.verifiers.length === 0) {
      this.logger.error('인앱결제 검증 설정이 없어 영수증을 확인할 수 없습니다.');
      throw new ServiceUnavailableException('결제 설정이 준비되지 않았습니다.');
    }

    const payload = await this.decode((verifier) =>
      verifier.verifyAndDecodeTransaction(signedTransactionInfo),
    );

    const { transactionId, originalTransactionId, productId, purchaseDate } = payload;
    if (!transactionId || !originalTransactionId || !productId || !purchaseDate) {
      this.logger.warn(`영수증에 필수 항목이 없습니다: ${JSON.stringify(Object.keys(payload))}`);
      throw new AppleIapError('MALFORMED_TRANSACTION', '영수증을 읽을 수 없습니다.');
    }

    return {
      transactionId,
      originalTransactionId,
      productId,
      purchasedAt: new Date(purchaseDate),
      amount: toKrw(payload.price, payload.currency),
      revokedAt: payload.revocationDate ? new Date(payload.revocationDate) : null,
      // 검증을 통과했다면 환경은 검증기와 일치한다. 값이 비어 오는 경우는 없지만
      // 타입상 optional 이라 Production 으로 좁히지 않고 그대로 둔다.
      environment: (payload.environment as Environment) ?? Environment.PRODUCTION,
    };
  }

  /**
   * App Store Server Notifications V2 의 `signedPayload` 를 검증한다.
   *
   * 알림은 누구나 우리 주소로 POST 할 수 있으므로 **서명 검증이 곧 인증이다.**
   * 검증을 통과하지 못한 본문은 Apple 이 보낸 것이 아니다.
   */
  async verifyNotification(signedPayload: string): Promise<ResponseBodyV2DecodedPayload> {
    if (this.verifiers.length === 0) {
      this.logger.error('인앱결제 검증 설정이 없어 알림을 확인할 수 없습니다.');
      throw new ServiceUnavailableException('결제 설정이 준비되지 않았습니다.');
    }

    return this.decode((verifier) => verifier.verifyAndDecodeNotification(signedPayload));
  }

  /**
   * 환경을 바꿔 가며 검증한다.
   *
   * 환경 불일치(INVALID_ENVIRONMENT)만 다음 검증기로 넘어가고, 서명이 깨졌거나 다른 앱의
   * 영수증이면 그 자리에서 거절한다 — 그런 영수증은 어느 환경에서도 유효하지 않다.
   *
   * 영수증과 알림이 같은 규칙을 쓰므로 검증 동작만 바꿔 끼운다.
   */
  private async decode<T>(verify: (verifier: SignedDataVerifier) => Promise<T>): Promise<T> {
    let lastError: VerificationException | null = null;

    for (const verifier of this.verifiers) {
      try {
        return await verify(verifier);
      } catch (error) {
        if (!(error instanceof VerificationException)) throw error;
        if (error.status !== VerificationStatus.INVALID_ENVIRONMENT) {
          this.logger.warn(`서명 검증 거절 (${VerificationStatus[error.status]})`);
          throw new AppleIapError(
            VerificationStatus[error.status],
            '영수증을 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.',
          );
        }
        lastError = error;
      }
    }

    // 모든 검증기가 환경 불일치로 거절한 경우 — 설정이 한쪽만 있을 때 여기로 온다.
    this.logger.warn(`환경이 서버 설정과 맞지 않습니다 (${lastError?.message ?? ''})`);
    throw new AppleIapError('INVALID_ENVIRONMENT', '영수증을 확인할 수 없습니다.');
  }
}

/**
 * 영수증의 청구 금액을 원 단위로 바꾼다.
 *
 * Apple 은 금액을 밀리단위로 준다 (4,900원 → 4900000). 원화가 아닌 스토어프론트에서 산
 * 경우에는 원 단위 컬럼에 넣을 수 없으므로 null 을 돌려주고, 호출한 쪽이 플랜 가격으로 대신한다.
 */
function toKrw(price: number | undefined, currency: string | undefined): number | null {
  if (price === undefined || currency !== 'KRW') return null;
  return Math.round(price / 1000);
}
