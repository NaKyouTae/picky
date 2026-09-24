'use client';

import { loadTossPayments, type TossPaymentsWidgets } from '@tosspayments/tosspayments-sdk';
import { useEffect, useRef, useState } from 'react';
import {
  MembershipIapPurchase,
  MembershipIapUnavailable,
} from '@/components/membership-iap-purchase';
import { MEMBERSHIP_CTA_CLASS, MEMBERSHIP_CTA_SPACE } from '@/components/membership-cta-bar';
import { formatKrw } from '@/lib/membership-format';
import type { MembershipPlan, PreparedOrder } from '@/lib/memberships';
import { isNativeApp, useIsIapAvailable, useIsNativeApp } from '@/lib/native-app';

const CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY ?? '';

/** 약관 위젯의 variantKey — 상점관리자에 등록된 UI 이름이다 */
const AGREEMENT_VARIANT = 'AGREEMENT';

/**
 * 결제수단 위젯의 variantKey.
 *
 * **위젯 안쪽(카드사 목록·약관)의 색은 코드로 바꿀 수 없다** — 토스가 iframe 으로 그리고,
 * 테마는 상점관리자의 '결제위젯 > UI 설정' 에서 정한다. 디자인(4694:5823)처럼 다크로 보이려면
 * 거기서 다크 UI 를 만들고 그 이름을 이 환경변수에 넣어야 한다.
 * 비어 있으면 상점 기본 UI 를 쓴다 (지금까지의 동작).
 */
const PAYMENT_METHODS_VARIANT = process.env.NEXT_PUBLIC_TOSS_PAYMENT_VARIANT ?? '';

/**
 * 결제 화면 본문 — 고른 회원권으로 토스 결제위젯을 띄운다.
 *
 * 금액이 정해진 뒤에 마운트되므로 위젯은 한 번만 그리면 된다 (회원권을 바꾸려면 뒤로 가서
 * 다시 고르고 들어온다).
 * 승인(= 이용 기간 부여)은 `/membership/success` 에서 서버가 하고, 여기서는 주문 생성과 결제 요청만 한다.
 *
 * **앱에서는 토스 위젯을 그리지 않는다.** 회원권 화면이 앱에서 이미 인앱결제로 가지만,
 * 이 주소로 직접 들어오는 경로가 남아 있어 여기서도 한 번 더 갈아끼운다 —
 * 앱 안에서 외부 결제가 한 프레임이라도 보이면 App Review Guideline 3.1.1 위반이다.
 */
export function MembershipCheckout({
  plan,
  customerKey,
  customerName,
  customerEmail,
  returnTo,
}: {
  plan: MembershipPlan;
  /** 구매자 식별자 — 유추 불가능해야 해서 사용자 uuid 를 쓴다 */
  customerKey: string;
  customerName: string;
  /** 선택 수집이라 없을 수 있다 — 토스에도 선택 파라미터라 없으면 넘기지 않는다 */
  customerEmail: string | null;
  /** 결제를 마친 뒤 돌아갈 화면 — 성공·실패 화면까지 그대로 들고 간다 */
  returnTo: string;
}) {
  const isApp = useIsNativeApp();
  const iapAvailable = useIsIapAvailable();

  const [ready, setReady] = useState(false);
  /** 필수 약관에 동의했는지 — 토스 약관 위젯이 알려준다 */
  const [agreed, setAgreed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const widgetsRef = useRef<TossPaymentsWidgets | null>(null);

  // 키가 없으면 어차피 위젯을 못 띄운다 — 렌더마다 같은 결과라 state 로 두지 않는다.
  const configError = CLIENT_KEY
    ? null
    : '결제 설정이 준비되지 않았습니다. 잠시 후 다시 시도해 주세요.';
  const shownError = error ?? configError;

  useEffect(() => {
    // 앱에서는 인앱결제로 갈아끼우므로 토스 SDK 자체를 불러오지 않는다.
    if (!CLIENT_KEY || isApp) return;

    let cancelled = false;

    void (async () => {
      try {
        const tossPayments = await loadTossPayments(CLIENT_KEY);
        if (cancelled) return;

        const widgets = tossPayments.widgets({ customerKey });
        await widgets.setAmount({ currency: 'KRW', value: plan.price });

        const [, agreement] = await Promise.all([
          widgets.renderPaymentMethods({
            selector: '#toss-payment-methods',
            ...(PAYMENT_METHODS_VARIANT ? { variantKey: PAYMENT_METHODS_VARIANT } : {}),
          }),
          widgets.renderAgreement({ selector: '#toss-agreement', variantKey: AGREEMENT_VARIANT }),
        ]);
        if (cancelled) return;

        // 필수 약관에 동의해야 결제 버튼이 열린다.
        agreement.on('agreementStatusChange', ({ agreedRequiredTerms }) => {
          setAgreed(agreedRequiredTerms);
        });

        widgetsRef.current = widgets;
        setReady(true);
      } catch (e) {
        if (cancelled) return;
        // 토스 SDK 는 code 를 함께 준다 — 상점 설정 문제와 일시적 오류를 구분하려면 필요하다.
        const code = (e as { code?: string })?.code;
        const message = e instanceof Error ? e.message : '결제 수단을 불러오지 못했습니다.';
        setError(code ? `[${code}] ${message}` : message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [customerKey, plan.price, isApp]);

  async function pay() {
    const widgets = widgetsRef.current;
    if (!widgets || pending) return;

    setPending(true);
    setError(null);

    let order: PreparedOrder;
    try {
      // 금액은 서버가 플랜에서 읽어 주문에 굳힌다 — 위젯 금액도 그 값에 맞춘다.
      const res = await fetch('/api/memberships/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: plan.id }),
      });
      if (!res.ok) throw new Error(await readError(res));
      order = (await res.json()) as PreparedOrder;

      await widgets.setAmount({ currency: 'KRW', value: order.amount });
    } catch (e) {
      setError(e instanceof Error ? e.message : '주문을 만들 수 없습니다.');
      setPending(false);
      return;
    }

    try {
      // 리다이렉트 방식 — 성공/실패 모두 우리 화면으로 돌아온다.
      const back = encodeURIComponent(returnTo);
      await widgets.requestPayment({
        orderId: order.orderCode,
        orderName: order.orderName,
        successUrl: `${window.location.origin}/membership/success?returnTo=${back}`,
        failUrl: `${window.location.origin}/membership/fail?returnTo=${back}`,
        customerName,
        customerEmail: customerEmail ?? undefined,
        // iOS 앱에서는 ISP/페이북 같은 카드사 앱으로 넘어갔다가 돌아와야 한다.
        // 앱 스킴을 주지 않으면 인증을 마치고도 카드사 앱에 머물러 결제가 끊긴다.
        // (스킴 등록: ios/Picky/Picky/Info.plist 의 CFBundleURLTypes)
        ...(isNativeApp() ? { card: { appScheme: 'picky://' } } : {}),
      });
    } catch (e) {
      // 창을 닫거나 결제가 중단된 경우 — 주문이 PENDING 으로 남지 않게 사유를 기록한다.
      const reason = e as { code?: string; message?: string };
      void fetch('/api/memberships/orders/fail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.orderCode,
          code: reason?.code,
          message: reason?.message,
        }),
      }).catch(() => null);

      setError(reason?.message ?? '결제가 취소되었습니다.');
      setPending(false);
    }
  }

  if (isApp) {
    // 인앱결제 화면들은 하단 고정 CTA(MembershipCtaBar)를 쓴다 — 이 화면의 아래 여백은
    // 고정 바를 전제하지 않으므로, 본문이 바에 가리지 않도록 그만큼 자리를 비워 둔다.
    const spacer = <div aria-hidden className="shrink-0" style={{ height: MEMBERSHIP_CTA_SPACE }} />;

    if (!iapAvailable)
      return (
        <>
          <MembershipIapUnavailable reason="outdated" />
          {spacer}
        </>
      );
    if (!plan.appleProductId)
      return (
        <>
          <MembershipIapUnavailable reason="unlisted" />
          {spacer}
        </>
      );
    return (
      <>
        <MembershipIapPurchase plans={[plan]} returnTo={returnTo} />
        {spacer}
      </>
    );
  }

  // 화면 껍데기(다크 배경·헤더·24px 간격)는 NightScreen 이 그린다 —
  // 여기서는 그 흐름에 얹히는 조각만 돌려준다 (회원권 고르기 화면과 같은 구성).
  return (
    <>
      {/* 토스가 그려 주는 결제수단·약관 위젯 자리 (id 는 renderXXX 의 selector 와 짝이다) */}
      <div className="w-full">
        <div id="toss-payment-methods" />
        <div id="toss-agreement" />
      </div>

      {!ready && !shownError && (
        <p className="text-center text-[14px] leading-[1.6] text-night-sub">
          결제 수단을 불러오는 중…
        </p>
      )}

      {shownError && (
        <p className="whitespace-pre-line text-[14px] leading-[1.6] text-picky-red">{shownError}</p>
      )}

      {/* 디자인(4694:5830)의 빈 칸 — 남은 높이를 먹어 버튼을 화면 아래로 민다 */}
      <div aria-hidden className="min-h-0 flex-1" />

      <button
        type="button"
        onClick={() => void pay()}
        disabled={pending || !ready || !agreed}
        className={MEMBERSHIP_CTA_CLASS}
      >
        {pending ? '결제창을 여는 중…' : `${formatKrw(plan.price)} 결제하기`}
      </button>
    </>
  );
}

/** NestJS 예외 필터가 내려주는 message 를 꺼내고, 형식이 다르면 상태 코드로 대체한다 */
async function readError(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
  const message = body?.message;
  if (Array.isArray(message)) return message.join('\n');
  return message ?? `요청이 실패했습니다 (${res.status})`;
}
