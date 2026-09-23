import { createOAuthCallbackHandler } from '@/lib/oauth-flow';

/** 네이버 콘솔 [API 설정]에 등록한 Callback URL 착지점 */
export const GET = createOAuthCallbackHandler('naver');
