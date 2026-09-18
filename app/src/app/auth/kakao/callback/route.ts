import { createOAuthCallbackHandler } from '@/lib/oauth-flow';

/** 카카오 콘솔에 등록한 Redirect URI 착지점 */
export const GET = createOAuthCallbackHandler('kakao');
