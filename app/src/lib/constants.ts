/** 로그인 세션 JWT (httpOnly) */
export const SESSION_COOKIE = 'picky_session';

/** OAuth 진행 중에만 존재하는 일회용 쿠키 */
export const OAUTH_STATE_COOKIE = 'picky_oauth_state';
export const OAUTH_NONCE_COOKIE = 'picky_oauth_nonce';
export const OAUTH_VERIFIER_COOKIE = 'picky_oauth_verifier';

/** 인가 화면에 머무는 시간을 감안한 일회용 쿠키 수명 (초) */
export const OAUTH_COOKIE_MAX_AGE = 10 * 60;

export const HOME_PATH = '/';
