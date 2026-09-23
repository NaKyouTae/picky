import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import type { Gender } from '../generated/prisma/enums';
import { dedupeConsents, mapConsentTag, type ProviderConsent } from './provider-consent';

const AUTHORIZE_ENDPOINT = 'https://kauth.kakao.com/oauth/authorize';
const TOKEN_ENDPOINT = 'https://kauth.kakao.com/oauth/token';
const USER_ME_ENDPOINT = 'https://kapi.kakao.com/v2/user/me';
const UNLINK_ENDPOINT = 'https://kapi.kakao.com/v1/user/unlink';
// 앱에 등록된 서비스 약관 전체 + 이 사용자의 동의 여부.
// 기본값(agreed_service_terms)은 동의한 약관만 주므로, 선택 약관을 '거부' 한 것과
// 아직 화면에 뜨지 않은 것을 구분할 수 없다. 그래서 app_service_terms 로 받는다.
const SERVICE_TERMS_ENDPOINT =
  'https://kapi.kakao.com/v2/user/service_terms?result=app_service_terms';

/** 인가 URL 과 함께 프론트가 쿠키에 보관해야 할 일회용 값들 */
export interface KakaoAuthorizeRequest {
  url: string;
  /** CSRF 방어 — 콜백 쿼리의 state 와 대조 */
  state: string;
  /** PKCE — 토큰 교환 시 code_verifier 로 되돌려 보냄 */
  codeVerifier: string;
}

/** 로그인에 필요한 프로필 (phone 아래는 선택 동의라 대개 비어 있다) */
export interface KakaoProfile {
  /** 카카오 회원번호 — Account.providerId */
  sub: string;
  /** 카카오계정 이메일 (선택 동의) — 거부했거나 미인증이면 null */
  email: string | null;
  /** 카카오계정 이름 (필수 동의) — 거부하면 인가 단계에서 막히므로 늘 채워져 온다 */
  name: string;
  /** 카카오계정 전화번호 (선택 동의) — 국내 번호만 숫자로 정규화해 담는다 */
  phone: string | null;
  gender: Gender | null;
  /** "20~29" 처럼 카카오가 주는 구간 문자열 그대로 */
  ageRange: string | null;
  birthday: Date | null;
  /** [간편가입 > 서비스 약관] 동의 내역 — 조회에 실패하면 빈 배열 */
  consents: ProviderConsent[];
}

/**
 * 카카오 로그인 (OAuth 2.0 Authorization Code + PKCE).
 *
 * OpenID Connect 를 쓰지 않는다 — `openid` 는 콘솔에서 OIDC 를 켜야만 요청할 수 있는데
 * 그 설정 없이 동작해야 해서, 신원은 액세스 토큰으로 부른 `/v2/user/me` 의 회원번호로 확인한다.
 * 인가 코드는 HTTPS 로 카카오와 직접 교환하고 PKCE 와 state 로 보호되므로,
 * 제3자가 끼워 넣은 토큰이 여기까지 올 수 없다 (id_token 의 nonce 가 하던 역할).
 *
 * REST API 키와 Client Secret 은 서버에만 둔다.
 */
@Injectable()
export class KakaoOAuthService {
  private readonly logger = new Logger(KakaoOAuthService.name);

  constructor(private readonly config: ConfigService) {}

  /** 카카오 developers > 앱 키 > REST API 키 (id_token 의 aud 와 같은 값) */
  private get clientId() {
    return this.config.getOrThrow<string>('KAKAO_REST_API_KEY');
  }

  /** [카카오 로그인 > 보안]에서 '사용함'으로 켠 경우에만 값이 있다 */
  private get clientSecret() {
    return this.config.get<string>('KAKAO_CLIENT_SECRET')?.trim() || null;
  }

  /** 카카오 콘솔에 등록한 값과 문자 단위로 같아야 한다 (토큰 교환 때도 그대로 전송) */
  private get redirectUri() {
    return this.config.getOrThrow<string>('KAKAO_REDIRECT_URI');
  }

  /**
   * 카카오 developers > 앱 키 > Admin 키.
   *
   * 탈퇴 시 연결 해제에만 쓴다 — 사용자의 액세스 토큰을 보관하지 않아도 회원번호만으로 끊을 수 있다.
   * 앱 전체를 다룰 수 있는 키라 서버에만 두고, 없으면 연결 해제를 건너뛴다(탈퇴는 그대로 진행).
   */
  private get adminKey() {
    return this.config.get<string>('KAKAO_ADMIN_KEY')?.trim() || null;
  }

  /**
   * 앱 연결 해제 — 탈퇴할 때 카카오 계정에서 picky 연결을 끊는다.
   * 발급된 액세스·리프레시 토큰이 모두 무효가 되고, 다시 로그인하면 동의화면부터 새로 뜬다.
   *
   * **실패해도 throw 하지 않는다** — 탈퇴는 사용자의 권리라 외부 API 장애로 막으면 안 된다.
   * 대신 성공 여부를 돌려주고, 끊지 못했으면 호출부가 사용자에게 직접 해제하도록 안내한다.
   *
   * @returns 연결이 실제로 끊겼으면 true
   */
  async unlink(providerId: string): Promise<boolean> {
    const { adminKey } = this;
    if (!adminKey) {
      this.logger.warn('KAKAO_ADMIN_KEY 가 없어 카카오 연결 해제를 건너뜁니다.');
      return false;
    }

    const res = await fetch(UNLINK_ENDPOINT, {
      method: 'POST',
      headers: {
        authorization: `KakaoAK ${adminKey}`,
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      },
      body: new URLSearchParams({ target_id_type: 'user_id', target_id: providerId }),
    }).catch((error: unknown) => {
      this.logger.warn(`카카오 연결 해제 실패: ${String(error)}`);
      return null;
    });

    if (!res) return false;
    if (!res.ok) {
      // 이미 연결이 끊긴 회원번호면 400(KOE101 등) — 목적은 달성된 상태라 성공으로 본다.
      this.logger.warn(`카카오 연결 해제 응답 (${res.status}): ${await res.text()}`);
      return res.status === 400;
    }
    return true;
  }

  /** 로그인 시작 — 인가 URL 과 일회용 값(state/nonce/codeVerifier)을 만든다. */
  createAuthorizeRequest(): KakaoAuthorizeRequest {
    const state = randomUrlSafe();
    const codeVerifier = randomUrlSafe(64);

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      // ⚠️ 여기 적은 항목은 모두 카카오 콘솔 [동의항목]에서 먼저 사용 설정돼 있어야 한다.
      //    설정되지 않은 항목이 섞이면 인가 단계에서 KOE205 로 거부된다.
      //
      //    필수 동의 — name, phone_number (거부하면 로그인 자체가 안 되므로 항상 온다)
      //    선택 동의 — account_email, gender, age_range, birthday, birthyear
      //               (사용자가 체크를 풀면 필드 자체가 오지 않는다)
      scope: 'account_email name phone_number gender age_range birthday birthyear',
      state,
      code_challenge: base64UrlEncode(createHash('sha256').update(codeVerifier).digest()),
      code_challenge_method: 'S256',
    });

    return { url: `${AUTHORIZE_ENDPOINT}?${params.toString()}`, state, codeVerifier };
  }

  /** 콜백으로 받은 code 를 프로필로 교환한다. */
  async exchangeCodeForProfile(code: string, codeVerifier: string): Promise<KakaoProfile> {
    const accessToken = await this.requestToken(code, codeVerifier);
    // 서로 다른 엔드포인트라 함께 부른다 (약관 조회는 실패해도 로그인을 막지 않는다).
    const [account, consents] = await Promise.all([
      this.requestAccount(accessToken),
      this.requestServiceTerms(accessToken),
    ]);

    return {
      sub: account.id,
      email: account.email,
      name: account.name,
      phone: account.phone,
      gender: account.gender,
      ageRange: account.ageRange,
      birthday: account.birthday,
      consents,
    };
  }

  /**
   * 간편가입 동의화면에서 받은 약관 동의 내역.
   *
   * 별도 scope 가 필요 없고 액세스 토큰만 있으면 된다.
   * **실패해도 절대 throw 하지 않는다** — 약관 동의는 로그인의 전제가 아니라 부가 정보라서,
   * 카카오 장애 때문에 로그인 자체가 막히면 안 된다 (다음 로그인에 다시 맞춰진다).
   */
  private async requestServiceTerms(accessToken: string): Promise<ProviderConsent[]> {
    const res = await fetch(SERVICE_TERMS_ENDPOINT, {
      method: 'GET',
      headers: { authorization: `Bearer ${accessToken}` },
    }).catch((error: unknown) => {
      this.logger.warn(`카카오 서비스 약관 조회 실패: ${String(error)}`);
      return null;
    });

    if (!res) return [];
    if (!res.ok) {
      // 콘솔에 등록된 약관이 없으면 빈 목록이 오고, 권한 문제는 4xx 로 온다.
      this.logger.warn(`카카오 서비스 약관 조회 실패 (${res.status}): ${await res.text()}`);
      return [];
    }

    let data: { service_terms?: KakaoServiceTerm[] };
    try {
      data = (await res.json()) as { service_terms?: KakaoServiceTerm[] };
    } catch (error: unknown) {
      this.logger.warn(`카카오 서비스 약관 응답을 해석할 수 없습니다: ${String(error)}`);
      return [];
    }

    const consents: ProviderConsent[] = [];
    for (const term of data.service_terms ?? []) {
      const tag = String(term?.tag ?? '').trim();
      if (!tag) continue;

      const type = mapConsentTag(tag);
      // 우리 동의 항목에 해당하지 않는 태그는 무시한다 (콘솔에 다른 약관이 더 있을 수 있다).
      if (!type) continue;

      consents.push({
        type,
        tag: tag.slice(0, 100),
        agreed: term.agreed === true,
        agreedAt: term.agreed === true ? parseAgreedAt(term.agreed_at) : null,
      });
    }

    return dedupeConsents(consents);
  }

  private async requestToken(code: string, codeVerifier: string): Promise<string> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      code,
      code_verifier: codeVerifier,
    });
    const { clientSecret } = this;
    if (clientSecret) body.set('client_secret', clientSecret);

    const res = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body,
    }).catch((error: unknown) => {
      this.logger.error(`카카오 토큰 엔드포인트 호출 실패: ${String(error)}`);
      return null;
    });

    if (!res) {
      throw new ServiceUnavailableException('카카오 인증 서버에 연결할 수 없습니다.');
    }

    if (!res.ok) {
      // invalid_grant(코드 재사용/만료), KOE006(Redirect URI 불일치) 등은 로그로만 남긴다.
      this.logger.warn(`카카오 토큰 교환 실패 (${res.status}): ${await res.text()}`);
      throw new UnauthorizedException('카카오 로그인에 실패했습니다. 다시 시도해 주세요.');
    }

    const data = (await res.json()) as { access_token?: string };
    if (!data.access_token) {
      this.logger.warn('카카오 응답에 access_token 이 없습니다.');
      throw new UnauthorizedException('카카오 로그인에 실패했습니다. 다시 시도해 주세요.');
    }
    return data.access_token;
  }

  /**
   * 회원번호·프로필 조회.
   *
   * 회원번호(`id`)가 Account.providerId 가 된다 — 우리 액세스 토큰으로 직접 부른 응답이라
   * id_token 과 같은 수준으로 신뢰할 수 있다.
   *
   * 이메일은 선택 동의라 없어도 로그인을 막지 않는다. 다만 **검증되지 않은 주소는 버린다** —
   * 회원을 묶는 기준은 phone 이라 이메일이 비어도 식별에는 문제가 없고,
   * 미인증 주소를 그대로 담아 두면 나중에 그것을 믿는 코드가 생겼을 때 위험해진다.
   */
  private async requestAccount(accessToken: string): Promise<KakaoAccountInfo> {
    const res = await fetch(USER_ME_ENDPOINT, {
      method: 'GET',
      headers: { authorization: `Bearer ${accessToken}` },
    }).catch((error: unknown) => {
      this.logger.error(`카카오 사용자 조회 실패: ${String(error)}`);
      return null;
    });

    if (!res) {
      throw new ServiceUnavailableException('카카오 인증 서버에 연결할 수 없습니다.');
    }
    if (!res.ok) {
      this.logger.warn(`카카오 사용자 조회 실패 (${res.status}): ${await res.text()}`);
      throw new UnauthorizedException('카카오 계정 정보를 불러올 수 없습니다.');
    }

    const data = (await res.json()) as { id?: number; kakao_account?: KakaoAccount };

    // 카카오 회원번호는 숫자로 오지만 providerId 는 문자열 칸이다.
    const id = data.id != null ? String(data.id) : '';
    if (!id) {
      throw new UnauthorizedException('카카오 계정 식별자를 받지 못했습니다.');
    }

    const account = data.kakao_account;
    const name = account?.name?.trim() ?? '';
    if (!name) {
      // 이름은 필수 동의라 여기까지 왔으면 늘 있다 — 없다면 콘솔 동의항목이 꺼진 것이다.
      throw new UnauthorizedException('카카오 계정 정보를 불러올 수 없습니다.');
    }

    return {
      id,
      email: parseEmail(account),
      name,
      // 아래는 모두 선택 동의 — 거부했으면 필드 자체가 오지 않는다.
      phone: parsePhone(account?.phone_number),
      gender: parseGender(account?.gender),
      ageRange: account?.age_range?.trim().slice(0, 20) || null,
      birthday: parseBirthday(account),
    };
  }
}

/** `/v2/user/me` 의 kakao_account 중 우리가 쓰는 부분 */
interface KakaoAccount {
  email?: string;
  is_email_valid?: boolean;
  is_email_verified?: boolean;
  /** 카카오계정 이름 — 필수 동의 */
  name?: string;
  /** 선택 동의. 국내는 "+82 10-1234-5678", 해외는 국가번호가 다르다 */
  phone_number?: string;
  gender?: string;
  /** "20~29" 형태 */
  age_range?: string;
  /** "MMDD" — 연도는 birthyear 로 따로 온다 */
  birthday?: string;
  birthday_type?: string;
  /** "YYYY" */
  birthyear?: string;
}

/** `/v2/user/service_terms` 의 service_terms 원소 */
interface KakaoServiceTerm {
  /** 콘솔에 등록한 약관 태그 */
  tag?: string;
  agreed?: boolean;
  required?: boolean;
  /** ISO 8601 (UTC) — 동의한 약관에만 온다 */
  agreed_at?: string;
}

interface KakaoAccountInfo {
  /** 카카오 회원번호 — Account.providerId */
  id: string;
  email: string | null;
  name: string;
  phone: string | null;
  gender: Gender | null;
  ageRange: string | null;
  birthday: Date | null;
}

/**
 * 카카오계정 이메일 — 선택 동의라 거부하면 필드 자체가 오지 않는다.
 *
 * 카카오가 미인증(`is_email_verified === false`)이나 사용 불가(`is_email_valid === false`)로
 * 표시한 주소는 버린다. 연락처 표기용으로만 쓰는 값이라 확실하지 않으면 비워 두는 편이 낫다.
 */
function parseEmail(account?: KakaoAccount): string | null {
  const email = account?.email?.trim();
  if (!email) return null;
  if (account?.is_email_valid === false || account?.is_email_verified === false) return null;
  return email;
}

/**
 * 카카오는 전화번호를 `"+82 10-1234-5678"` 형태로 준다.
 * User.phone 은 숫자만 보관하므로(`01012345678`) 국내 번호만 바꿔 담고,
 * 해외 번호는 형식이 제각각이라 받지 않는다.
 */
function parsePhone(value?: string): string | null {
  const raw = value?.trim();
  if (!raw) return null;

  const digits = raw.replace(/\D/g, '');
  // +82 10-1234-5678 → 821012345678 → 앞의 82 를 0 으로 되돌린다
  const local = digits.startsWith('82') ? `0${digits.slice(2)}` : digits;

  return /^01[016789]\d{7,8}$/.test(local) ? local : null;
}

function parseGender(value?: string): Gender | null {
  // 카카오는 female/male 만 준다 (Gender.OTHER 에 대응하는 값이 없다).
  if (value === 'male') return 'MALE';
  if (value === 'female') return 'FEMALE';
  return null;
}

/**
 * 카카오는 생일을 "MMDD"(birthday)와 "YYYY"(birthyear)로 나눠 준다.
 * 둘 다 동의를 받아야 날짜 하나를 만들 수 있다.
 */
function parseBirthday(account?: KakaoAccount): Date | null {
  const mmdd = account?.birthday?.trim();
  const year = account?.birthyear?.trim();

  if (!mmdd || !year) return null;
  // 음력 생일을 양력 Date 로 저장하면 틀린 날짜가 되므로 받지 않는다.
  if (account?.birthday_type === 'LUNAR') return null;
  if (!/^\d{4}$/.test(mmdd) || !/^\d{4}$/.test(year)) return null;

  const month = Number(mmdd.slice(0, 2));
  const day = Number(mmdd.slice(2, 4));
  // @db.Date 컬럼 — 시간대에 따라 날짜가 하루 밀리지 않도록 UTC 자정으로 만든다.
  const date = new Date(Date.UTC(Number(year), month - 1, day));

  // 2월 30일처럼 존재하지 않는 날짜는 Date 가 다음 달로 넘겨버리므로 되돌려 확인한다.
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}

/**
 * 카카오가 준 동의 시각. 형식이 어긋나거나 오지 않으면 null 을 돌려주고,
 * 호출부가 "언제인지는 모르지만 동의는 했다" 로 처리한다.
 */
function parseAgreedAt(value?: string): Date | null {
  const raw = value?.trim();
  if (!raw) return null;

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  // 시계 오차로 미래 시각이 오면 그대로 쓰지 않는다 (동의 시각이 미래면 만료 계산이 틀어진다).
  return date > new Date() ? null : date;
}

/** URL 에 그대로 넣을 수 있는 난수 문자열 */
function randomUrlSafe(bytes = 32): string {
  return base64UrlEncode(randomBytes(bytes));
}

function base64UrlEncode(buffer: Buffer): string {
  return buffer.toString('base64url');
}
