import { createAppleCallbackHandler } from '@/lib/oauth-flow';

/**
 * 애플 로그인 착지점 — **POST** 다.
 *
 * 애플은 scope 를 요청하면 `response_mode=form_post` 로 돌려보내므로 GET 이 아니다.
 * Apple Developer 의 Services ID > Return URLs 에 이 경로를 등록해야 한다.
 */
export const POST = createAppleCallbackHandler();
