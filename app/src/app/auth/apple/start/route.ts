import { createOAuthStartHandler } from '@/lib/oauth-flow';

/** 애플 로그인 시작 — state 쿠키를 심고 애플 동의 화면으로 리디렉션 */
export const GET = createOAuthStartHandler('apple');
