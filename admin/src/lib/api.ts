import { cookies } from 'next/headers';
import { ADMIN_SESSION_COOKIE } from './constants';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:21000/api';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? '';

type RequestOptions = Omit<RequestInit, 'body' | 'method'> & {
  body?: unknown;
  /** Next.js fetch 캐시 옵션 */
  next?: NextFetchRequestConfig;
};

async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers, ...rest } = options;
  const cookieStore = await cookies();
  // 로그인 세션 JWT 를 우선 사용하고, 없으면 서버 간 호출용 정적 토큰으로 폴백한다.
  const bearer = cookieStore.get(ADMIN_SESSION_COOKIE)?.value || ADMIN_TOKEN;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    method,
    headers: {
      'Content-Type': 'application/json',
      cookie: cookieStore.toString(),
      ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`API ${method} ${path} 실패 (${res.status}): ${detail}`);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** 서버 컴포넌트 전용 API 클라이언트 (관리자 토큰 자동 첨부) */
export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>('GET', path, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('POST', path, { ...options, body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('PATCH', path, { ...options, body }),
  delete: <T>(path: string, options?: RequestOptions) => request<T>('DELETE', path, options),
};

export { API_BASE_URL };
