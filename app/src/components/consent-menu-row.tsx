'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useConsents, type OptionalConsentKey } from '@/lib/use-consents';
import { cn } from '@/lib/utils';

/**
 * 마이페이지의 선택 동의 행 — 행을 누르면 상세 문서로 가고, 토글은 그 자리에서 켜고 끈다.
 * 철회 확인은 상세 화면의 동의 바에서 하고, 여기서는 즉시 반영한다(되돌리기 쉬운 조작).
 */
export function ConsentMenuRow({
  consentKey,
  label,
  href,
  icon,
}: {
  consentKey: OptionalConsentKey;
  label: string;
  href: string;
  icon: React.ReactNode;
}) {
  const { consents, loading, updating, setConsent } = useConsents();
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(timer);
  }, [toast]);

  const state = consents?.[consentKey];
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
      <div className="flex min-h-12 items-center gap-2.5 px-5">
        <Link href={href} className="flex min-w-0 flex-1 items-center gap-2.5 py-2 active:opacity-60">
          <span className="flex size-4 shrink-0 items-center justify-center text-ink">{icon}</span>
          <span className="truncate text-base font-medium">{label}</span>
        </Link>

        <button
          type="button"
          onClick={toggle}
          disabled={loading || !state || pending}
          aria-label={`${label} ${state?.agreed ? '철회' : '동의'}`}
          aria-pressed={state?.agreed ?? false}
          className="shrink-0 disabled:opacity-50"
        >
          <span
            className={cn(
              'relative flex h-6 w-11 items-center rounded-full transition-colors',
              state?.agreed ? 'bg-brand-500' : 'bg-line',
            )}
          >
            <span
              className={cn(
                'size-5 rounded-full bg-white shadow transition-transform',
                state?.agreed ? 'translate-x-[22px]' : 'translate-x-[2px]',
              )}
            />
          </span>
        </button>
      </div>

      {toast && (
        <div
          role="status"
          className="fixed left-1/2 z-50 -translate-x-1/2 rounded-full bg-black/80 px-4 py-2 text-[13px] text-white"
          style={{ bottom: 'calc(var(--safe-bottom) + 32px)' }}
        >
          {toast}
        </div>
      )}
    </>
  );
}
