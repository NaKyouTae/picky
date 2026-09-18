import { cookies } from 'next/headers';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:21000/api';

type RequestOptions = Omit<RequestInit, 'body' | 'method'> & {
  body?: unknown;
  /** Next.js fetch 캐시 옵션 */
  next?: NextFetchRequestConfig;
};

async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers, ...rest } = options;
  const cookieStore = await cookies();

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    method,
    headers: {
      'Content-Type': 'application/json',
      cookie: cookieStore.toString(),
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
