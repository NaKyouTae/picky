'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ConsentKey, Consents } from '@/lib/consent-format';

// 타입·포맷터는 `lib/consent-format.ts` 에 있다 (서버 컴포넌트도 쓰기 때문).
// 기존 import 경로를 깨지 않도록 여기서도 타입을 다시 내보낸다.
export type {
  ConsentKey,
  ConsentSource,
  ConsentState,
  Consents,
  MarketingConsentState,
  OptionalConsentKey,
  RequiredConsentKey,
} from '@/lib/consent-format';

/**
 * 동의 상태 조회·변경.
 * 서버 주소는 감춰져 있으므로 BFF 프록시(/api/auth/consents)를 통해 NestJS 로 간다.
 *
 * `initial` 을 주면(서버 컴포넌트에서 미리 읽어 온 값) 첫 조회를 건너뛴다 —
 * 같은 화면에 이 훅을 쓰는 행이 여러 개 있어도 요청이 늘어나지 않고, 깜빡임도 없다.
 */
export function useConsents(initial?: Consents | null) {
  const [consents, setConsents] = useState<Consents | null>(initial ?? null);
  const [loading, setLoading] = useState(!initial);
  const [updating, setUpdating] = useState<ConsentKey | null>(null);

  const refresh = useCallback(async () => {
    const consents = await fetchConsents();
    setLoading(false);
    if (consents) setConsents(consents);
  }, []);

  useEffect(() => {
    // 서버에서 받아 온 값이 있으면 그대로 쓴다 (변경은 아래 setConsent 가 갱신한다).
    if (initial) return;

    // 응답이 늦게 와도 언마운트된 화면에 쓰지 않는다.
    let alive = true;
    void (async () => {
      const consents = await fetchConsents();
      if (!alive) return;
      setLoading(false);
      if (consents) setConsents(consents);
    })();
    return () => {
      alive = false;
    };
  }, [initial]);

  /** 낙관적 반영 — 실패하면 이전 상태로 되돌리고 throw 하므로 호출부가 안내를 띄운다. */
  const setConsent = useCallback(
    async (key: ConsentKey, next: boolean) => {
      if (!consents || updating) return;
      setUpdating(key);

      const previous = consents;
      const nowIso = new Date().toISOString();
      // 화면에서 직접 바꾼 것이라 출처는 SELF — 서버 응답이 오면 어차피 덮인다.
      if (key === 'marketing') {
        const expires = new Date();
        expires.setFullYear(expires.getFullYear() + 2);
        setConsents({
          ...consents,
          marketing: {
            agreed: next,
            agreedAt: next ? nowIso : null,
            source: next ? 'SELF' : null,
            expiresAt: next ? expires.toISOString() : null,
            expired: false,
          },
        });
      } else {
        setConsents({
          ...consents,
          [key]: { agreed: next, agreedAt: next ? nowIso : null, source: next ? 'SELF' : null },
        });
      }

      try {
        const res = await fetch('/api/auth/consents', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [key]: next }),
        });
        if (!res.ok) throw new Error('consent update failed');
        setConsents((await res.json()) as Consents);
      } catch (error) {
        setConsents(previous);
        throw error;
      } finally {
        setUpdating(null);
      }
    },
    [consents, updating],
  );

  return { consents, loading, updating, setConsent, refresh };
}

/** 비로그인(401)·네트워크 오류면 null — 화면은 동의 상태를 단정하지 않는다. */
async function fetchConsents(): Promise<Consents | null> {
  try {
    const res = await fetch('/api/auth/consents', { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as Consents;
  } catch {
    return null;
  }
}
