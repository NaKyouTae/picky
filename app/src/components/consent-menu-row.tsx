'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { type Consents, type OptionalConsentKey } from '@/lib/consent-format';
import { useConsents } from '@/lib/use-consents';
import { cn } from '@/lib/utils';

/**
 * 마이페이지의 선택 동의 행 — 행을 누르면 상세 문서로 가고, on/off 는 그 자리에서 켜고 끈다.
 * 철회 확인은 상세 화면의 동의 바에서 하고, 여기서는 즉시 반영한다(되돌리기 쉬운 조작).
 *
 * 디자인(Figma 4658:3858)의 on/off 는 스위치가 아니라 두 칸짜리 세그먼트다 —
 * 지금 상태인 쪽(동의/미동의)이 point 색, 반대쪽이 gray600 으로 칠해진다.
 */
export function ConsentMenuRow({
  consentKey,
  label,
  href,
  initialConsents,
}: {
  consentKey: OptionalConsentKey;
  label: string;
  href: string;
  /** 서버 컴포넌트가 미리 읽어 온 동의 상태 — 있으면 첫 조회를 건너뛴다 */
  initialConsents?: Consents | null;
}) {
  const { consents, loading, updating, setConsent } = useConsents(initialConsents);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(timer);
  }, [toast]);

  const state = consents?.[consentKey];
  const agreed = state?.agreed ?? false;
  const pending = updating === consentKey;

  async function toggle() {
    if (!state) return;
    const next = !state.agreed;
    try {
      await setConsent(consentKey, next);
      setToast(next ? '동의 처리되었어요.' : '동의가 철회되었어요.');
    } catch {
      setToast('변경하지 못했어요. 잠시 후 다시 시도해 주세요.');
    }
  }

  return (
    <>
      {/* 높이 처리는 같은 목록의 MenuLink 와 맞춘다 — 본문 24px + 위아래 5px */}
      <div className="flex items-center justify-between gap-3">
        <Link
          href={href}
          className="min-w-0 flex-1 truncate py-[5px] text-[16px] leading-6 active:opacity-60"
        >
          {label}
        </Link>

        <button
          type="button"
          onClick={toggle}
          disabled={loading || !state || pending}
          aria-label={`${label} ${agreed ? '철회' : '동의'}`}
          aria-pressed={agreed}
          // 폭은 '미동의' 가 12px 로 들어가는 크기다 — 한 칸(48px)에 글자 36px + 좌우 여백.
          className="flex h-[34px] w-24 shrink-0 items-stretch py-[5px] text-[12px] leading-none whitespace-nowrap disabled:opacity-50"
        >
          <span
            className={cn(
              'flex flex-1 items-center justify-center',
              agreed ? 'bg-point' : 'bg-night-raised',
            )}
          >
            동의
          </span>
          <span
            className={cn(
              'flex flex-1 items-center justify-center',
              agreed ? 'bg-night-raised' : 'bg-point',
            )}
          >
            미동의
          </span>
        </button>
      </div>

      {toast && (
        <div
          role="status"
          className="fixed left-1/2 z-50 -translate-x-1/2 rounded-full bg-night-raised px-4 py-2 text-[13px] text-night-text"
          style={{ bottom: 'calc(var(--safe-bottom) + 32px)' }}
        >
          {toast}
        </div>
      )}
    </>
  );
}
