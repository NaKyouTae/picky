import { cookies } from 'next/headers';
import { SESSION_COOKIE } from './constants';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:21000/api';

type RequestOptions = Omit<RequestInit, 'body' | 'method'> & {
  body?: unknown;
  /** Next.js fetch 캐시 옵션 */
  next?: NextFetchRequestConfig;
};

async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers, ...rest } = options;
  const cookieStore = await cookies();
  // NestJS 의 JwtAuthGuard 는 쿠키가 아니라 Authorization 헤더를 본다.
  // httpOnly 쿠키의 JWT 를 서버 사이드에서만 헤더로 바꿔 붙인다.
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    method,
    headers: {
      'Content-Type': 'application/json',
      cookie: cookieStore.toString(),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`API ${method} ${path} 실패 (${res.status}): ${detail}`);
  }

  if (res.status === 204) return undefined as T;

  // 서버가 null 을 반환하면 200 + 빈 본문으로 온다 (예: 진행 중인 그룹 없음).
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

/** 서버 컴포넌트 전용 API 클라이언트 (httpOnly 쿠키 그대로 전달) */
export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>('GET', path, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('POST', path, { ...options, body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('PATCH', path, { ...options, body }),
  delete: <T>(path: string, options?: RequestOptions) => request<T>('DELETE', path, options),
};

export { API_BASE_URL };
