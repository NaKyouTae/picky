'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { DottedDivider } from '@/components/dotted-divider';
import { MembershipBenefits } from '@/components/membership-benefits';
import { MembershipCtaBar, MEMBERSHIP_CTA_CLASS } from '@/components/membership-cta-bar';
import { MembershipPlanPicker } from '@/components/membership-plan-picker';
import { formatDate, formatKrw } from '@/lib/membership-format';
import type { MembershipOrder, MembershipPlan } from '@/lib/memberships';
import type { IapReceipt } from '@/lib/native-app';
import {
  fetchIapProducts,
  finishIapTransaction,
  purchaseIapProduct,
  restoreIapReceipts,
  type IapFailureReason,
} from '@/lib/native-app';

/** 결제 실패 사유별 안내 — 사용자가 다음에 뭘 해야 할지 알 수 있게 쓴다 */
const FAILURE_MESSAGES: Record<IapFailureReason, string> = {
  cancelled: '결제를 취소했어요.',
  pending: '결제 승인을 기다리고 있어요. 승인이 끝나면 자동으로 이용 기간이 더해집니다.',
  unavailable: '지금은 이 회원권을 살 수 없어요. 잠시 후 다시 시도해 주세요.',
  unverified: '영수증을 확인할 수 없어요. 고객센터로 문의해 주세요.',
  failed: '결제를 마치지 못했어요. 잠시 후 다시 시도해 주세요.',
};

type Phase =
  /** App Store 에서 가격을 읽는 중 */
  | { name: 'loading' }
  | { name: 'ready' }
  /** StoreKit 결제창이 떠 있는 중 */
  | { name: 'purchasing' }
  /** 결제는 끝났고 서버에 이용 기간을 적립하는 중 */
  | { name: 'redeeming' }
  | { name: 'done'; order: MembershipOrder };

/**
 * iOS 앱의 회원권 구매 — App Store 인앱결제.
 *
 * 앱 안에서 열리는 유료 템플릿은 외부 결제로 팔 수 없어(App Review Guideline 3.1.1)
 * 앱에서는 토스 결제창을 띄우지 않고 StoreKit 으로만 판다.
 *
 * 흐름이 웹과 반대다 — **StoreKit 이 결제를 먼저 끝내고, 그 영수증으로 서버가 주문을 만든다.**
 * 그래서 적립에 실패해도 돈은 이미 빠져나간 상태다. 그 경우 영수증을 들고 다시 시도할 수
 * 있도록 버튼을 남겨 둔다 (서버는 같은 영수증을 여러 번 받아도 한 번만 적립한다).
 */
export function MembershipIapPurchase({
  plans,
  returnTo,
}: {
  /** App Store 상품 ID 가 있는 회원권만 넘어온다 */
  plans: MembershipPlan[];
  returnTo: string;
}) {
  const [selectedId, setSelectedId] = useState(plans[0]?.id ?? null);
  const [phase, setPhase] = useState<Phase>({ name: 'loading' });
  const [error, setError] = useState<string | null>(null);
  /** 결제는 됐는데 적립에 실패한 영수증 — 다시 시도할 때 이 값을 쓴다 */
  const [pendingReceipt, setPendingReceipt] = useState<IapReceipt | null>(null);
  const [priceLabels, setPriceLabels] = useState<Record<string, string>>({});

  const selected = plans.find((plan) => plan.id === selectedId) ?? null;

  // App Store 가격을 읽어 온다. 실제로 청구되는 값이라 우리 DB 가격보다 이쪽이 맞다.
  // 함께 미적립 영수증도 확인한다 — 결제만 되고 이용 기간이 안 들어간 상태로 남지 않게.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const productIds = plans
        .map((plan) => plan.appleProductId)
        .filter((id): id is string => Boolean(id));

      const [products, receipts] = await Promise.all([
        fetchIapProducts(productIds),
        restoreIapReceipts(),
      ]);
      if (cancelled) return;

      const byProductId = new Map(products.map((product) => [product.productId, product]));
      const labels: Record<string, string> = {};
      for (const plan of plans) {
        const product = plan.appleProductId ? byProductId.get(plan.appleProductId) : undefined;
        if (product) labels[plan.id] = product.displayPrice;
      }

      setPriceLabels(labels);
      // 가격을 못 읽어도 결제 자체는 시도할 수 있으므로 화면은 연다.
      // (상품이 정말 없으면 결제 시점에 unavailable 로 걸러진다)
      setPhase({ name: 'ready' });

      // 지난번에 결제만 되고 적립이 안 된 영수증이 있으면 먼저 처리하게 한다.
      // 자동으로 보내지 않고 버튼으로 두는 이유는, 무슨 일이 있었는지 알려 주기 위해서다.
      const [leftover] = receipts;
      if (leftover) {
        setPendingReceipt(leftover);
        setError('지난 결제가 아직 반영되지 않았어요. 아래 버튼을 눌러 이용 기간을 받아 주세요.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [plans]);

  /**
   * 서버에 영수증을 넘겨 이용 기간을 받는다.
   *
   * 적립에 성공한 뒤에야 거래를 닫는다 — 먼저 닫으면 실패했을 때 영수증을 다시 얻을 수 없다.
   */
  async function redeem(receipt: IapReceipt) {
    setPhase({ name: 'redeeming' });

    try {
      const res = await fetch('/api/memberships/orders/apple', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signedTransactionInfo: receipt.signedTransactionInfo }),
      });
      if (!res.ok) throw new Error(await readError(res));

      const order = (await res.json()) as MembershipOrder;
      await finishIapTransaction(receipt.transactionId);

      setPendingReceipt(null);
      setPhase({ name: 'done', order });
    } catch (e) {
      // 결제는 끝났으니 영수증을 쥐고 있다가 다시 시도한다.
      setPendingReceipt(receipt);
      setError(e instanceof Error ? e.message : '이용 기간을 적용하지 못했어요.');
      setPhase({ name: 'ready' });
    }
  }

  async function buy() {
    if (!selected?.appleProductId) return;

    setError(null);
    setPhase({ name: 'purchasing' });

    const result = await purchaseIapProduct(selected.appleProductId);
    if (!result.ok) {
      setError(FAILURE_MESSAGES[result.reason]);
      setPhase({ name: 'ready' });
      return;
    }

    await redeem({
      transactionId: result.transactionId,
      signedTransactionInfo: result.signedTransactionInfo,
    });
  }

  if (phase.name === 'done') {
    const { order } = phase;
    return (
      <>
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <p className="text-[16px] font-medium leading-none">결제가 완료됐어요</p>
          <p className="mt-4 text-[14px] leading-none text-night-sub">
            {order.planName} · {formatKrw(order.amount)}
          </p>
          {order.endsAt && (
            <p className="mt-6 rounded-lg bg-night-card px-5 py-4 text-[14px] font-medium leading-none text-point">
              {formatDate(order.endsAt)}까지 유료 템플릿을 쓸 수 있어요
            </p>
          )}
          <Link
            href="/mypage/payments"
            className="mt-6 text-[14px] leading-none text-night-sub underline active:opacity-60"
          >
            결제 내역 보기
          </Link>
        </div>

        <MembershipCtaBar>
          <Link href={returnTo} className={MEMBERSHIP_CTA_CLASS}>
            콜라주 만들러 가기
          </Link>
        </MembershipCtaBar>
      </>
    );
  }

  const busy = phase.name === 'purchasing' || phase.name === 'redeeming';

  return (
    <>
      <MembershipPlanPicker
        plans={plans}
        selectedId={selectedId}
        onSelect={setSelectedId}
        priceLabels={priceLabels}
      />

      <DottedDivider />

      <MembershipBenefits />

      {/* 결제 실패·미적립 안내는 버튼 바로 위에 둔다 — 다음에 누를 곳이 그 아래다 */}
      {error && <p className="text-[14px] leading-[1.6] text-picky-red">{error}</p>}

      <MembershipCtaBar>
        <button
          type="button"
          onClick={() => void (pendingReceipt ? redeem(pendingReceipt) : buy())}
          disabled={busy || phase.name === 'loading' || !selected?.appleProductId}
          className={MEMBERSHIP_CTA_CLASS}
        >
          {buttonLabel()}
        </button>
      </MembershipCtaBar>
    </>
  );

  function buttonLabel(): string {
    if (phase.name === 'loading') return '불러오는 중…';
    if (phase.name === 'purchasing') return '결제 중…';
    if (phase.name === 'redeeming') return '이용 기간을 적용하는 중…';
    // 결제를 마친 영수증이 남아 있으면 결제부터 다시 하지 않는다.
    if (pendingReceipt) return '이용 기간 다시 받기';
    if (!selected) return '회원권을 선택해 주세요';
    return 'Pro 회원으로 계속하기';
  }
}

/** NestJS 예외 필터가 내려주는 message 를 꺼내고, 형식이 다르면 상태 코드로 대체한다 */
async function readError(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
  const message = body?.message;
  if (Array.isArray(message)) return message.join('\n');
  return message ?? `요청이 실패했습니다 (${res.status})`;
}

/**
 * 앱에서 인앱결제를 쓸 수 없을 때의 안내.
 *
 * **여기서 토스 결제로 되돌리면 안 된다** — 앱 안에서 외부 결제를 노출하는 것이
 * App Review Guideline 3.1.1 위반이라 심사에서 걸린다. 팔 수 없으면 팔지 않는다.
 */
export function MembershipIapUnavailable({
  reason,
}: {
  /** outdated: 인앱결제 브리지가 없는 예전 앱 빌드 · unlisted: 상품이 연결되지 않은 회원권 */
  reason: 'outdated' | 'unlisted';
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <p className="text-[16px] font-medium leading-none">
        {reason === 'outdated' ? '앱 업데이트가 필요해요' : '지금은 구매할 수 없어요'}
      </p>
      <p className="mt-4 text-[14px] leading-[1.6] text-night-sub">
        {reason === 'outdated'
          ? 'App Store에서 Picky를 최신 버전으로 업데이트한 뒤 다시 시도해 주세요.'
          : '회원권을 준비하고 있어요. 조금만 기다려 주세요.'}
      </p>
    </div>
  );
}
