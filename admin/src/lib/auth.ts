import { cookies } from 'next/headers';
import { API_BASE_URL } from './api';
import { ADMIN_SESSION_COOKIE } from './constants';

export type AdminSession = { username: string; role: 'ADMIN' };

/** 현재 요청의 세션 토큰 (없으면 null) */
export async function getSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(ADMIN_SESSION_COOKIE)?.value ?? null;
}

/**
 * 서버에 토큰 유효성을 확인한다.
 * 쿠키 존재 여부만으로는 만료·위조를 걸러낼 수 없으므로 실제 검증은 NestJS 가 담당한다.
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  const token = await getSessionToken();
  if (!token) return null;

  const res = await fetch(`${API_BASE_URL}/admin/auth/me`, {
    headers: { authorization: `Bearer ${token}` },
    cache: 'no-store',
  }).catch(() => null);

  if (!res?.ok) return null;
  return (await res.json()) as AdminSession;
}
