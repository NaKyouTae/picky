import { Injectable, Logger, ServiceUnavailableException, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleAuth } from 'google-auth-library';

/** Play Developer API. 우리가 쓰는 것은 일회성 상품의 조회·소비 두 개뿐이다. */
const ANDROID_PUBLISHER = 'https://androidpublisher.googleapis.com/androidpublisher/v3';
const SCOPE = 'https://www.googleapis.com/auth/androidpublisher';

/** 검증을 마친 Play 구매 — 우리가 쓰는 값만 추린다 */
export interface VerifiedGooglePurchase {
  /** 구매 한 건의 고유 키. 중복 적립을 막는 멱등 키다 */
  purchaseToken: string;
  /** Play Console 에 등록한 상품 ID — 우리 플랜과 이어 준다 */
  productId: string;
  /** `GPA.0000-0000-0000-00000` — 환불 조회 때 Play 가 쓰는 기준값. 시험 구매에는 없다 */
  orderId: string | null;
  purchasedAt: Date;
  /** 실제 청구 금액 (원 단위). 원화가 아니면 null — 호출한 쪽이 플랜 가격으로 대신한다 */
  amount: number | null;
  /** 라이선스 테스터의 시험 구매인지 (실제 매출이 아니다) */
  isTest: boolean;
}

/** 검증 거절 — 사용자에게 보여 줄 수 있는 사유다 (AppleIapError 와 같은 역할) */
export class GoogleIapError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Play Developer API 가 돌려주는 일회성 상품 구매 — 우리가 읽는 필드만 적는다 */
interface ProductPurchase {
  /** 0 = 구매 완료, 1 = 취소, 2 = 보류(후불 결제 대기) */
  purchaseState?: number;
  /** 0 = 아직 소비 안 함, 1 = 소비함 */
  consumptionState?: number;
  /** 0 = 확인 안 함(acknowledge 필요), 1 = 확인함 */
  acknowledgementState?: number;
  purchaseTimeMillis?: string;
  orderId?: string;
  priceAmountMicros?: string;
  priceCurrencyCode?: string;
  /** 0 = 실결제, 1 = 시험 구매(라이선스 테스터) */
  purchaseType?: number;
  regionCode?: string;
}

/**
 * Google Play 인앱결제 검증.
 *
 * 앱이 Play Billing 에서 받은 구매 토큰을 그대로 넘기면, 이 서비스가 **Play Developer API 에
 * 직접 물어봐서** 그 구매가 실재하고 유효한지 확인한다. Apple 이 서명 영수증을 오프라인으로
 * 검증하는 것과 달리 Play 는 서버 조회 방식이다 — 앱이 보낸 값은 토큰 하나뿐이고 상품·금액·
 * 상태는 전부 구글에게서 받는다.
 *
 * **앱이 보낸 상품 ID·구매 여부를 그대로 믿지 않는 이유는 Apple 쪽과 같다** —
 * 루팅 기기나 프록시로 위조한 값이 올 수 있다.
 *
 * ## 소비(consume)를 서버가 한다
 *
 * Play 는 **3일 안에 확인(acknowledge)하지 않은 구매를 자동 환불한다.** 앱에 맡기면 그 사이
 * 앱이 꺼지거나 지워졌을 때 돈만 돌아가고 기간은 남는 상태가 된다. 그래서 서버가 이용 기간을
 * 부여한 직후에 직접 소비한다 — 소비는 확인을 겸하고, 같은 상품을 다시 살 수 있게도 만든다
 * (기간제를 반복 구매해 이어 붙이는 판매 방식이라 소모성 상품이다).
 *
 * ## 설정
 *
 * - `GOOGLE_PLAY_PACKAGE_NAME` — `kr.spectrify.picky`
 * - `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` — Play Console 에 연결한 서비스 계정 키(JSON 전문).
 *   Google Cloud 에서 만들고 Play Console > 사용자 및 권한에서 '재무 데이터 보기'와
 *   '주문 관리' 권한을 줘야 한다. 비어 있으면 안드로이드 결제를 받지 않는다.
 */
@Injectable()
export class GoogleIapService implements OnModuleInit {
  private readonly logger = new Logger(GoogleIapService.name);

  private packageName: string | null = null;
  private auth: GoogleAuth | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const packageName = this.config.get<string>('GOOGLE_PLAY_PACKAGE_NAME');
    const credentials = this.config.get<string>('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON');

    if (!packageName || !credentials) {
      this.logger.warn(
        'GOOGLE_PLAY_PACKAGE_NAME / GOOGLE_PLAY_SERVICE_ACCOUNT_JSON 이 없어 ' +
          'Play 인앱결제 검증을 비활성화합니다.',
      );
      return;
    }

    try {
      this.auth = new GoogleAuth({ credentials: JSON.parse(credentials), scopes: [SCOPE] });
      this.packageName = packageName;
    } catch {
      // 키 JSON 이 깨진 채로 떠 있으면 결제 때마다 실패한다. 뜰 때 알아채는 편이 낫다.
      this.logger.error('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON 을 읽지 못했습니다 (JSON 형식 확인).');
    }
  }

  /** 안드로이드 결제를 받을 수 있는 설정인지. */
  get isConfigured(): boolean {
    return this.auth !== null && this.packageName !== null;
  }

  /**
   * 구매 토큰을 검증해 구매 정보를 돌려준다.
   *
   * @throws {GoogleIapError} 없는 구매·취소·보류 등 사용자에게 알려 줄 수 있는 거절
   * @throws {ServiceUnavailableException} 서버에 검증 설정이 없는 경우
   */
  async verifyPurchase(productId: string, purchaseToken: string): Promise<VerifiedGooglePurchase> {
    const purchase = await this.get(productId, purchaseToken);

    // 0 = 구매 완료. 1(취소)·2(보류)로는 기간을 주지 않는다.
    // 보류는 후불 결제가 아직 승인되지 않은 상태라, 승인되면 앱이 다시 보낸다.
    if (purchase.purchaseState === 1) {
      throw new GoogleIapError('CANCELED_PURCHASE', '취소된 결제입니다.');
    }
    if (purchase.purchaseState === 2) {
      throw new GoogleIapError('PENDING_PURCHASE', '결제가 아직 완료되지 않았습니다.');
    }

    // 이미 소비한 토큰이면 기간도 이미 줬다는 뜻이다 — 다만 판단은 주문 표가 한다
    // (소비 직후 앱이 재시도하는 정상 경로가 있으므로 여기서 막지 않는다).
    return {
      purchaseToken,
      productId,
      orderId: purchase.orderId ?? null,
      purchasedAt: purchase.purchaseTimeMillis
        ? new Date(Number(purchase.purchaseTimeMillis))
        : new Date(),
      amount: toKrw(purchase.priceAmountMicros, purchase.priceCurrencyCode),
      isTest: purchase.purchaseType === 0,
    };
  }

  /**
   * 구매를 소비한다 — 확인(acknowledge)을 겸하고 같은 상품을 다시 살 수 있게 한다.
   *
   * **이용 기간을 부여한 뒤에 부른다.** 실패해도 이용 기간을 되돌리지 않는다 — 돈은 이미
   * 받았고 기간도 줬으므로, 소비만 다시 시도하면 되는 상태다. 다만 3일 안에 성공하지 못하면
   * 구글이 자동 환불하므로 실패는 반드시 로그로 남긴다.
   */
  async consume(productId: string, purchaseToken: string): Promise<void> {
    const { auth, packageName } = this.require();
    const client = await auth.getClient();
    const url =
      `${ANDROID_PUBLISHER}/applications/${encodeURIComponent(packageName)}` +
      `/purchases/products/${encodeURIComponent(productId)}` +
      `/tokens/${encodeURIComponent(purchaseToken)}:consume`;

    try {
      await client.request({ url, method: 'POST' });
    } catch (error) {
      this.logger.error(
        `Play 구매 소비 실패 — 3일 안에 처리하지 못하면 자동 환불됩니다: ` +
          `productId=${productId} ${describe(error)}`,
      );
      throw error;
    }
  }

  private async get(productId: string, purchaseToken: string): Promise<ProductPurchase> {
    const { auth, packageName } = this.require();
    const client = await auth.getClient();
    const url =
      `${ANDROID_PUBLISHER}/applications/${encodeURIComponent(packageName)}` +
      `/purchases/products/${encodeURIComponent(productId)}` +
      `/tokens/${encodeURIComponent(purchaseToken)}`;

    try {
      const response = await client.request<ProductPurchase>({ url });
      return response.data;
    } catch (error) {
      const status = (error as { response?: { status?: number } }).response?.status;

      // 404 = 그런 구매가 없다. 토큰을 지어냈거나 다른 앱·상품의 토큰이다.
      if (status === 404) {
        this.logger.warn(`알 수 없는 Play 구매: productId=${productId}`);
        throw new GoogleIapError('UNKNOWN_PURCHASE', '결제를 확인할 수 없습니다.');
      }
      // 401/403 = 서비스 계정 권한 문제다. 사용자 잘못이 아니므로 설정 오류로 알린다.
      if (status === 401 || status === 403) {
        this.logger.error(`Play Developer API 권한 오류 (${status}) — 서비스 계정 권한 확인`);
        throw new ServiceUnavailableException('결제 설정이 준비되지 않았습니다.');
      }

      this.logger.error(`Play 구매 조회 실패: ${describe(error)}`);
      throw new GoogleIapError(
        'VERIFY_FAILED',
        '결제를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.',
      );
    }
  }

  private require(): { auth: GoogleAuth; packageName: string } {
    if (!this.auth || !this.packageName) {
      this.logger.error('Play 인앱결제 설정이 없어 구매를 확인할 수 없습니다.');
      throw new ServiceUnavailableException('결제 설정이 준비되지 않았습니다.');
    }
    return { auth: this.auth, packageName: this.packageName };
  }
}

/**
 * 청구 금액을 원 단위로 바꾼다.
 *
 * Play 는 금액을 마이크로단위로 준다 (4,900원 → 4900000000). 원화가 아닌 지역에서 산 경우에는
 * 원 단위 컬럼에 넣을 수 없으므로 null 을 돌려주고, 호출한 쪽이 플랜 가격으로 대신한다.
 */
function toKrw(micros: string | undefined, currency: string | undefined): number | null {
  if (!micros || currency !== 'KRW') return null;
  const value = Number(micros);
  return Number.isFinite(value) ? Math.round(value / 1_000_000) : null;
}

/** 로그에 남길 오류 요약 — 응답 본문에 토큰이 섞일 수 있어 상태와 메시지만 적는다 */
function describe(error: unknown): string {
  const status = (error as { response?: { status?: number } }).response?.status;
  const message = error instanceof Error ? error.message : String(error);
  return status ? `status=${status} ${message}` : message;
}
