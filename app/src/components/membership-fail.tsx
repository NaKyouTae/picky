'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { MEMBERSHIP_CTA_CLASS } from '@/components/membership-cta-bar';
import { NightNotice } from '@/components/night-screen';

/**
 * 결제 실패 안내 — 결제 완료 화면(4694:5860)과 같은 구성이다 (안내 한 장 + 버튼).
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
    <>
      <NightNotice
        grow
        title="결제가 완료되지 않았어요"
        description={
          <>
            <span className="whitespace-pre-line">{message ?? '결제가 중단되었습니다.'}</span>
            {code && (
              <>
                <br />
                오류 코드 {code}
              </>
            )}
          </>
        }
      />

      <Link href="/membership" className={MEMBERSHIP_CTA_CLASS}>
        다시 시도하기
      </Link>
      <Link
        href={returnTo}
        className="text-center text-[14px] leading-none text-night-sub underline active:opacity-60"
      >
        {returnTo.startsWith('/collage') ? '콜라주로 돌아가기' : '메인으로 돌아가기'}
      </Link>
    </>
  );
}
