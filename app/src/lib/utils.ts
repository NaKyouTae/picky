import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 쿼리로 받은 복귀 경로를 우리 앱 안의 경로로 한정한다.
 *
 * `//evil.com` 같은 값은 브라우저가 외부 주소로 읽으므로 그대로 쓰면 열린 리다이렉트가 된다.
 */
export function internalPath(value: string | undefined | null, fallback: string): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return fallback;
  return value;
}
