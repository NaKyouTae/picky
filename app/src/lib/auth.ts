import { cookies } from 'next/headers';
import { API_BASE_URL } from './api';
import { SESSION_COOKIE } from './constants';

export type Session = {
  id: string;
  /** 제공자가 준 이메일 — 선택 동의라 비어 있을 수 있다 */
  email: string | null;
  name: string;
  /** 제공자가 준 연락처 — 선택 동의라 비어 있을 수 있다 */
  phone: string | null;
  role: 'USER' | 'ADMIN';
};

/**
 * 현재 로그인한 사용자.
 * 쿠키 존재만으로는 만료·위조·정지를 걸러낼 수 없으므로 검증은 NestJS 가 담당한다.
 */
export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const res = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: { authorization: `Bearer ${token}` },
    cache: 'no-store',
  }).catch(() => null);

  if (!res?.ok) return null;
  return (await res.json()) as Session;
}
