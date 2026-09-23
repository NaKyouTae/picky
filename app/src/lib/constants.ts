/** 로그인 세션 JWT (httpOnly) */
export const SESSION_COOKIE = 'picky_session';

/** OAuth 진행 중에만 존재하는 일회용 쿠키 */
export const OAUTH_STATE_COOKIE = 'picky_oauth_state';
export const OAUTH_VERIFIER_COOKIE = 'picky_oauth_verifier';

/** 인가 화면에 머무는 시간을 감안한 일회용 쿠키 수명 (초) */
export const OAUTH_COOKIE_MAX_AGE = 10 * 60;

/**
 * 마지막으로 로그인에 성공한 제공자 — 로그인 화면의 '최근 로그인' 말풍선에 쓴다.
 * 로그인 화면이 서버 컴포넌트라 httpOnly 로 두고 서버에서만 읽는다.
 */
export const LAST_PROVIDER_COOKIE = 'picky_last_provider';

/** 힌트일 뿐이라 세션보다 오래 남겨 둔다 (1년) */
export const LAST_PROVIDER_MAX_AGE = 365 * 24 * 60 * 60;

export const HOME_PATH = '/';
export const LOGIN_PATH = '/login';
