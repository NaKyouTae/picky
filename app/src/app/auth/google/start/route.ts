import { createOAuthStartHandler } from '@/lib/oauth-flow';

/** 구글 로그인 시작 — state/nonce 쿠키를 심고 구글 동의 화면으로 리디렉션 */
export const GET = createOAuthStartHandler('google');
