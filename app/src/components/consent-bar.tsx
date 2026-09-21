'use client';

import { useEffect, useState } from 'react';
import { Modal, type DialogState } from '@/components/modal';
import {
  formatAgreedAt,
  formatExpiresAt,
  useConsents,
  type ConsentKey,
} from '@/lib/use-consents';
import { cn } from '@/lib/utils';

type Config =
  | { required: true; label: string }
  | {
      required: false;
      label: string;
      /** 철회는 되돌리기 쉬워도 사용자가 의도했는지 한 번 확인한다 */
      revoke: { title: string; description: string };
    };

const CONFIG: Record<ConsentKey, Config> = {
  terms: { required: true, label: '이용약관' },
  privacy: { required: true, label: '개인정보 수집·이용' },
  marketing: {
    required: false,
    label: '마케팅 정보 수신',
    revoke: {
      title: '마케팅 정보 수신을 끄시겠어요?',
      description: '동의를 철회하면 새 기능과 이벤트 안내를 받지 못해요.',
    },
  },
  thirdParty: {
    required: false,
    label: '개인정보 제3자 제공',
    revoke: {
      title: '제3자 제공 동의를 철회하시겠어요?',
      description: '소셜 로그인 등 일부 기능 이용에 제한이 생길 수 있어요.',
    },
  },
};

/**
 * 약관 문서 화면 하단에 붙는 동의 바.
 *
 * 필수 항목은 동의만 받고(철회는 회원 탈퇴), 선택 항목은 토글로 켜고 끈다.
 * 앱 셸이 translate 로 fixed 의 컨테이닝 블록이라 이 바는 셸 하단에 정확히 붙는다.
 */
export function ConsentBar({ consentKey }: { consentKey: ConsentKey }) {
  const { consents, loading, updating, setConsent } = useConsents();
  const [dialog, setDialog] = useState<DialogState>('closed');
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(timer);
  }, [toast]);

  const config = CONFIG[consentKey];
  const state = consents?.[consentKey];
  const pending = updating === consentKey;

  // 상태를 아직 모를 때 '동의 안 함' 으로 단정하지 않는다.
  const status = !state
    ? loading
      ? '동의 상태 확인 중…'
      : ''
    : state.agreed
      ? formatAgreedAt(state.agreedAt)
      : '아직 동의하지 않았어요';

  const expiresAt =
    consentKey === 'marketing' && consents?.marketing.agreed
      ? formatExpiresAt(consents.marketing.expiresAt)
      : '';

  async function apply(next: boolean) {
    setDialog('closing');
    try {
      await setConsent(consentKey, next);
      setToast(next ? '동의 처리되었어요.' : '동의가 철회되었어요.');
    } catch {
      setToast('변경하지 못했어요. 잠시 후 다시 시도해 주세요.');
    }
  }

  function handleToggle() {
    if (!state) return;
    // 철회만 확인을 거친다 — 다시 켜는 것은 되돌리기 쉬우므로 즉시 반영한다.
    if (state.agreed) setDialog('open');
    else void apply(true);
  }

  return (
    <>
      <div className="pb-bar fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white px-5 pt-3">
        <div className="flex min-h-11 items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  'rounded px-1.5 py-0.5 text-[10px] font-semibold',
                  config.required ? 'bg-brand-500 text-white' : 'bg-canvas text-ink-sub',
                )}
              >
                {config.required ? '필수' : '선택'}
              </span>
              <span className="truncate text-sm font-medium">{config.label}</span>
            </div>
            <p className="mt-0.5 text-xs text-ink-sub">{status}</p>
            {expiresAt && <p className="text-[11px] text-ink-sub">{expiresAt}</p>}
          </div>

          {config.required ? (
            state?.agreed ? (
              <span className="shrink-0 rounded-lg bg-canvas px-3 py-1.5 text-xs font-medium text-ink-sub">
                동의 완료
              </span>
            ) : (
              <button
                type="button"
                onClick={() => void apply(true)}
                disabled={loading || !state || pending}
                className="h-10 shrink-0 rounded-xl bg-brand-500 px-5 text-sm font-semibold text-white active:bg-brand-600 disabled:opacity-60"
              >
                {pending ? '처리 중…' : '동의하기'}
              </button>
            )
          ) : (
            <button
              type="button"
              onClick={handleToggle}
              disabled={loading || !state || pending}
              aria-label={`${config.label} ${state?.agreed ? '동의 철회' : '동의'}`}
              aria-pressed={state?.agreed ?? false}
              className="shrink-0 disabled:opacity-50"
            >
              <span
                className={cn(
                  'relative flex h-7 w-13 items-center rounded-full transition-colors',
                  state?.agreed ? 'bg-brand-500' : 'bg-line',
                )}
              >
                <span
                  className={cn(
                    'size-6 rounded-full bg-white shadow transition-transform',
                    state?.agreed ? 'translate-x-[26px]' : 'translate-x-[2px]',
                  )}
                />
              </span>
            </button>
          )}
        </div>
      </div>

      {!config.required && (
        <Modal
          state={dialog}
          onRequestClose={() => setDialog('closing')}
          onClosed={() => setDialog('closed')}
          labelledBy="consent-revoke-title"
        >
          <h2 id="consent-revoke-title" className="text-base font-bold">
            {config.revoke.title}
          </h2>
          <p className="mt-1.5 text-sm text-ink-sub">{config.revoke.description}</p>

          <div className="mt-6 space-y-2">
            <button
              type="button"
              onClick={() => void apply(false)}
              className="h-12 w-full rounded-2xl bg-brand-500 text-base font-semibold text-white active:bg-brand-600"
            >
              동의 철회
            </button>
            <button
              type="button"
              onClick={() => setDialog('closing')}
              className="h-12 w-full rounded-2xl border border-line bg-white text-base font-semibold text-ink active:bg-canvas"
            >
              취소
            </button>
          </div>
        </Modal>
      )}

      {/* 바를 가리지 않도록 그 위에 띄운다 */}
      {toast && (
        <div
          role="status"
          className="fixed left-1/2 z-50 -translate-x-1/2 rounded-full bg-black/80 px-4 py-2 text-[13px] text-white"
          style={{ bottom: 'calc(var(--safe-bottom) + 96px)' }}
        >
          {toast}
        </div>
      )}
    </>
  );
}
