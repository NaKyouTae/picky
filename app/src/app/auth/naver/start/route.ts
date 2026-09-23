import { createOAuthStartHandler } from '@/lib/oauth-flow';

/** 네이버 로그인 시작 — state 쿠키를 심고 네이버 정보제공동의 화면으로 리디렉션 */
export const GET = createOAuthStartHandler('naver');
