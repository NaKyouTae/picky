'use client';

import { useCallback, useEffect, useState } from 'react';

export type ConsentKey = 'terms' | 'privacy' | 'marketing' | 'thirdParty';
/** 동의만 받는 항목 — 철회하면 서비스를 쓸 수 없어 회원 탈퇴로만 거둘 수 있다 */
export type RequiredConsentKey = 'terms' | 'privacy';
/** 켜고 끌 수 있는 항목 */
export type OptionalConsentKey = 'marketing' | 'thirdParty';

export type ConsentState = { agreed: boolean; agreedAt: string | null };
export type MarketingConsentState = ConsentState & {
  expiresAt: string | null;
  expired: boolean;
};

export type Consents = {
  terms: ConsentState;
  privacy: ConsentState;
  marketing: MarketingConsentState;
  thirdParty: ConsentState;
};

/**
 * 동의 상태 조회·변경.
 * 서버 주소는 감춰져 있으므로 BFF 프록시(/api/auth/consents)를 통해 NestJS 로 간다.
 */
export function useConsents() {
  const [consents, setConsents] = useState<Consents | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<ConsentKey | null>(null);

  const refresh = useCallback(async () => {
    const consents = await fetchConsents();
    setLoading(false);
    if (consents) setConsents(consents);
  }, []);

  useEffect(() => {
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
  }, []);

  /** 낙관적 반영 — 실패하면 이전 상태로 되돌리고 throw 하므로 호출부가 안내를 띄운다. */
  const setConsent = useCallback(
    async (key: ConsentKey, next: boolean) => {
      if (!consents || updating) return;
      setUpdating(key);

      const previous = consents;
      const nowIso = new Date().toISOString();
      if (key === 'marketing') {
        const expires = new Date();
        expires.setFullYear(expires.getFullYear() + 2);
        setConsents({
          ...consents,
          marketing: {
            agreed: next,
            agreedAt: next ? nowIso : null,
            expiresAt: next ? expires.toISOString() : null,
            expired: false,
          },
        });
      } else {
        setConsents({ ...consents, [key]: { agreed: next, agreedAt: next ? nowIso : null } });
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

/** "2026. 09. 21. 동의" — 동의한 적이 없으면 빈 문자열 */
export function formatAgreedAt(iso: string | null): string {
  const date = iso ? new Date(iso) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  return `${formatDate(date)} 동의`;
}

/** "2028. 09. 21. 만료" — 만료일이 없으면 빈 문자열 */
export function formatExpiresAt(iso: string | null): string {
  const date = iso ? new Date(iso) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  return `${formatDate(date)} 만료`;
}

function formatDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}. ${month}. ${day}.`;
}
