import { createOAuthCallbackHandler } from '@/lib/oauth-flow';

/** 구글 콘솔의 '승인된 리디렉션 URI' 착지점 */
export const GET = createOAuthCallbackHandler('google');
