'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';

/**
 * 결제 실패 안내.
 *
 * 화면은 쿼리로 온 사유를 그대로 보여주고, 주문이 PENDING 으로 남지 않도록
 * 서버에 실패를 한 번 기록한다 (기록이 실패해도 사용자에게는 영향이 없다).
 */
export function MembershipFail({
  orderId,
  code,
  message,
  returnTo,
}: {
  orderId: string | null;
  code: string | null;
  message: string | null;
  /** 결제를 시작한 화면 */
  returnTo: string;
}) {
  const reported = useRef(false);

  useEffect(() => {
    if (!orderId || reported.current) return;
    reported.current = true;

    void fetch('/api/memberships/orders/fail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, code, message }),
    }).catch(() => null);
  }, [orderId, code, message]);

  return (
    <div className="flex flex-1 flex-col px-5">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <p className="text-base font-semibold">결제가 완료되지 않았어요</p>
        <p className="mt-2 whitespace-pre-line text-sm text-ink-sub">
          {message ?? '결제가 중단되었습니다.'}
        </p>
        {code && <p className="mt-2 text-xs text-ink-sub">오류 코드 {code}</p>}
      </div>

      <div className="pb-bar space-y-2 pt-4">
        <Link
          href="/membership"
          className="flex h-14 w-full items-center justify-center rounded-2xl bg-brand-500 text-base font-semibold text-white active:bg-brand-600"
        >
          다시 시도하기
        </Link>
        <Link
          href={returnTo}
          className="flex h-12 w-full items-center justify-center text-sm font-medium text-ink-sub"
        >
          콜라주로 돌아가기
        </Link>
      </div>
    </div>
  );
}
