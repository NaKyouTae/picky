'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { MEMBERSHIP_CTA_CLASS } from '@/components/membership-cta-bar';
import { NightNotice } from '@/components/night-screen';
import { SparkleMark } from '@/components/sparkle-mark';
import { formatDate, formatKrw } from '@/lib/membership-format';
import type { MembershipOrder } from '@/lib/memberships';

type State =
  | { phase: 'confirming' }
  | { phase: 'done'; order: MembershipOrder }
  | { phase: 'error'; message: string };

/**
 * 결제 승인 — 결제창이 성공으로 돌려보낸 값을 서버에 넘겨 결제를 확정한다.
 *
 * 결제창의 성공 리다이렉트만으로는 결제가 끝나지 않는다. 서버가 토스에 승인을 요청해야
 * 비로소 확정되고 이용 기간이 부여된다. 새로고침으로 두 번 호출돼도 서버가 멱등하게 처리한다.
 *
 * 화면은 디자인 4694:5860 의 '결제 완료' 다 — 껍데기(헤더·다크 배경)는 NightScreen 이 그리고,
 * 여기서는 안내 한 장과 버튼만 돌려준다.
 */
export function MembershipConfirm({
  paymentKey,
  orderId,
  amount,
  returnTo,
}: {
  paymentKey: string;
  orderId: string;
  amount: number;
  /** 결제를 시작한 화면 — 콜라주에서 왔다면 인증 사진이 그대로 있는 그 화면으로 돌아간다 */
  returnTo: string;
}) {
  const [state, setState] = useState<State>({ phase: 'confirming' });
  /** Strict Mode 의 이중 실행으로 승인이 두 번 나가지 않게 한다 */
  const requested = useRef(false);

  useEffect(() => {
    if (requested.current) return;
    requested.current = true;

    void (async () => {
      try {
        const res = await fetch('/api/memberships/orders/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentKey, orderId, amount }),
        });
        if (!res.ok) throw new Error(await readError(res));
        setState({ phase: 'done', order: (await res.json()) as MembershipOrder });
      } catch (e) {
        setState({
          phase: 'error',
          message: e instanceof Error ? e.message : '결제를 확정하지 못했습니다.',
        });
      }
    })();
  }, [paymentKey, orderId, amount]);

  if (state.phase === 'confirming') {
    return (
      <NightNotice
        grow
        title="결제를 확인하고 있어요"
        description="창을 닫지 말고 잠시만 기다려 주세요."
      />
    );
  }

  if (state.phase === 'error') {
    return (
      <>
        <NightNotice
          grow
          title="결제를 확정하지 못했어요"
          description={
            <>
              <span className="whitespace-pre-line">{state.message}</span>
              <br />
              주문번호 {orderId}
            </>
          }
        />
        <Link href="/membership" className={MEMBERSHIP_CTA_CLASS}>
          다시 시도하기
        </Link>
        {/* 승인이 이미 지나갔는데 화면만 실패했을 수 있어, 내역을 직접 확인할 길을 남긴다 */}
        <Link
          href="/mypage/payments"
          className="text-center text-[14px] leading-none text-night-sub underline active:opacity-60"
        >
          결제 내역 보기
        </Link>
      </>
    );
  }

  const { order } = state;
  return (
    <>
      <NightNotice
        grow
        mark={<SparkleMark />}
        title={
          <>
            Picky Pro와
            <br />
            함께해주셔서 감사해요 !
          </>
        }
        // 이용 기간은 승인 시점에 굳혀 내려온다. 혹시 비어 있으면 무엇을 샀는지라도 보여 준다.
        description={
          order.endsAt
            ? `혜택은 ${formatDate(order.endsAt)}까지 이어져요.`
            : `${order.planName} · ${formatKrw(order.amount)}`
        }
      />
      <Link href={returnTo} className={MEMBERSHIP_CTA_CLASS}>
        {returnLabel(returnTo)}
      </Link>
    </>
  );
}

/**
 * 돌아갈 곳에 맞춘 버튼 문구.
 *
 * 디자인(4694:5870)의 '메인으로 바로가기' 는 돌아갈 곳이 홈일 때의 문구다. 콜라주에서
 * 잠긴 템플릿을 눌러 들어왔다면 그 화면으로 돌려보내야 인증 사진이 다시 채워지므로,
 * 목적지를 홈으로 바꾸지 않고 문구만 그 화면을 가리키게 둔다.
 */
function returnLabel(returnTo: string): string {
  return returnTo.startsWith('/collage') ? '콜라주 만들러 가기' : '메인으로 바로가기';
}

/** NestJS 예외 필터가 내려주는 message 를 꺼내고, 형식이 다르면 상태 코드로 대체한다 */
async function readError(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
  const message = body?.message;
  if (Array.isArray(message)) return message.join('\n');
  return message ?? `요청이 실패했습니다 (${res.status})`;
}
