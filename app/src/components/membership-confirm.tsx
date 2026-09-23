'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
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
      <div className="flex flex-1 flex-col items-center justify-center px-5 text-center">
        <p className="text-base font-semibold">결제를 확인하고 있어요</p>
        <p className="mt-2 text-sm text-ink-sub">창을 닫지 말고 잠시만 기다려 주세요.</p>
      </div>
    );
  }

  if (state.phase === 'error') {
    return (
      <div className="flex flex-1 flex-col px-5">
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <p className="text-base font-semibold">결제를 확정하지 못했어요</p>
          <p className="mt-2 whitespace-pre-line text-sm text-ink-sub">{state.message}</p>
          <p className="mt-2 text-xs text-ink-sub">주문번호 {orderId}</p>
        </div>
        <div className="pb-bar space-y-2 pt-4">
          <Link
            href="/membership"
            className="flex h-14 w-full items-center justify-center rounded-2xl bg-brand-500 text-base font-semibold text-white active:bg-brand-600"
          >
            다시 시도하기
          </Link>
          <Link
            href="/mypage/payments"
            className="flex h-12 w-full items-center justify-center text-sm font-medium text-ink-sub"
          >
            결제 내역 보기
          </Link>
        </div>
      </div>
    );
  }

  const { order } = state;
  return (
    <div className="flex flex-1 flex-col px-5">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <p className="text-lg font-bold">결제가 완료됐어요</p>
        <p className="mt-2 text-sm text-ink-sub">
          {order.planName} · {formatKrw(order.amount)}
        </p>
        {order.endsAt && (
          <p className="mt-4 rounded-xl bg-brand-500/10 px-4 py-3 text-sm font-medium text-brand-600">
            {formatDate(order.endsAt)}까지 유료 템플릿을 쓸 수 있어요
          </p>
        )}
      </div>

      <div className="pb-bar space-y-2 pt-4">
        <Link
          href={returnTo}
          className="flex h-14 w-full items-center justify-center rounded-2xl bg-brand-500 text-base font-semibold text-white active:bg-brand-600"
        >
          콜라주 만들러 가기
        </Link>
        <Link
          href="/mypage/payments"
          className="flex h-12 w-full items-center justify-center text-sm font-medium text-ink-sub"
        >
          결제 내역 보기
        </Link>
      </div>
    </div>
  );
}

/** NestJS 예외 필터가 내려주는 message 를 꺼내고, 형식이 다르면 상태 코드로 대체한다 */
async function readError(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
  const message = body?.message;
  if (Array.isArray(message)) return message.join('\n');
  return message ?? `요청이 실패했습니다 (${res.status})`;
}
