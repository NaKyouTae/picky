import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import type { Gender } from '../generated/prisma/enums';
import { dedupeConsents, mapConsentTag, type ProviderConsent } from './provider-consent';

const AUTHORIZE_ENDPOINT = 'https://nid.naver.com/oauth2.0/authorize';
const TOKEN_ENDPOINT = 'https://nid.naver.com/oauth2.0/token';
const PROFILE_ENDPOINT = 'https://openapi.naver.com/v1/nid/me';

/** 인가 URL 과 함께 프론트가 쿠키에 보관해야 할 일회용 값 */
export interface NaverAuthorizeRequest {
  url: string;
  /** CSRF 방어 — 콜백 쿼리의 state 와 대조하고, 토큰 교환 때도 함께 보낸다 */
  state: string;
}

/** 로그인에 필요한 프로필 (email 아래는 '추가' 제공이라 대개 비어 있다) */
export interface NaverProfile {
  /** 네이버 회원 식별자 — Account.providerId */
  sub: string;
  /** 연락처 이메일 주소 — '추가' 제공이라 거부하면 null */
  email: string | null;
  /** 회원이름 (필수 제공) */
  name: string;
  /** 휴대전화번호 (필수 제공) — 국내 번호만 숫자로 정규화해 담는다 */
  phone: string | null;
  gender: Gender | null;
  /** "20-29" 처럼 네이버가 주는 구간 문자열 그대로 */
  ageRange: string | null;
  birthday: Date | null;
  /** '네이버 로그인 플러스' 동의화면에서 받은 약관 동의 내역 — 없으면 빈 배열 */
  consents: ProviderConsent[];
  /**
   * 갱신 토큰 — 탈퇴할 때 연결 해제 API 를 부르는 데만 쓴다.
   *
   * 프로필은 아니지만 로그인 응답에서만 얻을 수 있는 값이라 여기에 함께 실어 보낸다.
   * 호출부가 암호화해 accounts 에 보관한다. 네이버가 주지 않으면 null 이다.
   */
  refreshToken: string | null;
}

/**
 * 네이버 로그인 (OAuth 2.0 Authorization Code).
 *
 * **PKCE 를 쓰지 않는다** — 네이버 인가 엔드포인트가 `code_challenge` 를 지원하지 않는다.
 * 대신 state 를 쿠키와 대조하고, 토큰 교환 때 state 를 다시 보내 확인한다.
 * 인가 코드는 HTTPS 로 네이버와 직접 교환하므로 제3자가 끼워 넣은 코드가 여기까지 오지 못한다.
 *
 * Client ID/Secret 은 서버에만 둔다.
 */
@Injectable()
export class NaverOAuthService {
  private readonly logger = new Logger(NaverOAuthService.name);
  /** 약관 필드를 찾지 못했다는 경고는 한 번만 — 매 로그인마다 찍히면 로그가 묻힌다 */
  private warnedMissingTerms = false;

  constructor(private readonly config: ConfigService) {}

  /** 네이버 developers > 내 애플리케이션 > 개요 > Client ID */
  private get clientId() {
    return this.config.getOrThrow<string>('NAVER_CLIENT_ID');
  }

  private get clientSecret() {
    return this.config.getOrThrow<string>('NAVER_CLIENT_SECRET');
  }

  /** 네이버 콘솔 [API 설정 > 로그인 오픈 API 서비스 환경]에 등록한 Callback URL 과 같아야 한다 */
  private get redirectUri() {
    return this.config.getOrThrow<string>('NAVER_REDIRECT_URI');
  }

  /**
   * 탈퇴 시 앱 연결 해제 (`grant_type=delete`).
   *
   * 네이버에는 카카오의 어드민 키처럼 회원번호만으로 끊는 방법이 없고 **그 사용자의
   * 액세스 토큰**을 요구한다. 액세스 토큰은 로그인 직후 한 시간이면 만료되므로,
   * 로그인 때 받아 둔 갱신 토큰으로 새 액세스 토큰을 발급받아 그것으로 끊는다.
   *
   * **실패해도 throw 하지 않는다** — 탈퇴는 사용자의 권리라 외부 API 장애로 막으면 안 된다.
   * 끊지 못하면 false 를 돌려주고, 호출부가 `manualDisconnect` 로 내보내
   * 사용자가 [네이버 내정보 > 보안설정 > 연결된 서비스 관리]에서 직접 끊도록 안내한다.
   *
   * @param refreshToken 로그인 때 보관해 둔 갱신 토큰 (복호화된 평문). 없으면 끊을 수 없다.
   * @returns 연결이 실제로 끊겼으면 true
   */
  async unlink(refreshToken: string | null): Promise<boolean> {
    if (!refreshToken) {
      // 이 컬럼이 생기기 전에 로그인한 계정이거나, 비밀이 바뀌어 복호화하지 못한 경우다.
      this.logger.warn('보관된 네이버 갱신 토큰이 없어 연결 해제를 건너뜁니다.');
      return false;
    }

    const accessToken = await this.refreshAccessToken(refreshToken);
    if (!accessToken) return false;

    const params = new URLSearchParams({
      grant_type: 'delete',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      access_token: accessToken,
      service_provider: 'NAVER',
    });

    const data = await this.requestTokenEndpoint(params, '연결 해제');
    // 네이버는 성공하면 result: "success" 를 준다 (실패는 200 에 error 를 담아 오기도 한다).
    return data?.result === 'success';
  }

  /**
   * 갱신 토큰으로 액세스 토큰을 다시 받는다 (연결 해제 직전에만 쓴다).
   *
   * 사용자가 이미 네이버에서 직접 연결을 끊었으면 여기서 실패한다 — 그때는 목적이
   * 이미 달성된 것이지만 응답만으로는 장애와 구분되지 않아 성공으로 치지 않는다.
   * (직접 해제 안내가 한 번 더 뜨는 정도라 사용자가 잃는 것은 없다.)
   */
  private async refreshAccessToken(refreshToken: string): Promise<string | null> {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: refreshToken,
    });

    const data = await this.requestTokenEndpoint(params, '액세스 토큰 재발급');
    return data?.access_token ?? null;
  }

  /**
   * 토큰 엔드포인트 호출 — 실패하면 null (throw 하지 않는다).
   * 탈퇴 경로에서만 쓰므로 어떤 이유로 실패하든 '끊지 못했다' 로 수렴시킨다.
   */
  private async requestTokenEndpoint(
    params: URLSearchParams,
    what: string,
  ): Promise<NaverTokenResponse | null> {
    const res = await fetch(`${TOKEN_ENDPOINT}?${params.toString()}`, { method: 'GET' }).catch(
      (error: unknown) => {
        this.logger.warn(`네이버 ${what} 호출 실패: ${String(error)}`);
        return null;
      },
    );

    if (!res) return null;
    if (!res.ok) {
      this.logger.warn(`네이버 ${what} 응답 (${res.status}): ${await res.text()}`);
      return null;
    }

    // 네이버는 실패해도 200 에 error 를 담아 주는 경우가 있어 본문까지 확인한다.
    const data = (await res.json().catch(() => null)) as NaverTokenResponse | null;
    if (!data || data.error) {
      this.logger.warn(`네이버 ${what} 실패 (error=${data?.error ?? '본문 없음'}).`);
      return null;
    }
    return data;
  }

  /** 로그인 시작 — 인가 URL 과 일회용 state 를 만든다. */
  createAuthorizeRequest(): NaverAuthorizeRequest {
    const state = randomUrlSafe();

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      state,
    });

    return { url: `${AUTHORIZE_ENDPOINT}?${params.toString()}`, state };
  }

  /** 콜백으로 받은 code 를 프로필로 교환한다 (탈퇴 때 쓸 갱신 토큰도 함께 싣는다). */
  async exchangeCodeForProfile(code: string, state: string): Promise<NaverProfile> {
    const { accessToken, refreshToken } = await this.requestToken(code, state);
    const profile = await this.requestProfile(accessToken);
    return { ...profile, refreshToken };
  }

  private async requestToken(
    code: string,
    state: string,
  ): Promise<{ accessToken: string; refreshToken: string | null }> {
    // 네이버는 토큰 교환을 쿼리스트링으로 받는다 (redirect_uri 는 보내지 않는다).
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code,
      state,
    });

    const res = await fetch(`${TOKEN_ENDPOINT}?${params.toString()}`, {
      method: 'GET',
    }).catch((error: unknown) => {
      this.logger.error(`네이버 토큰 엔드포인트 호출 실패: ${String(error)}`);
      return null;
    });

    if (!res) {
      throw new ServiceUnavailableException('네이버 인증 서버에 연결할 수 없습니다.');
    }
    if (!res.ok) {
      this.logger.warn(`네이버 토큰 교환 실패 (${res.status}): ${await res.text()}`);
      throw new UnauthorizedException('네이버 로그인에 실패했습니다. 다시 시도해 주세요.');
    }

    // 네이버는 실패해도 200 에 error 필드를 담아 주는 경우가 있어 본문까지 확인한다.
    const data = (await res.json()) as NaverTokenResponse;
    if (!data.access_token) {
      this.logger.warn(`네이버 응답에 access_token 이 없습니다 (error=${data.error ?? '없음'}).`);
      throw new UnauthorizedException('네이버 로그인에 실패했습니다. 다시 시도해 주세요.');
    }
    if (!data.refresh_token) {
      // 로그인은 문제없이 되지만 탈퇴할 때 연결을 끊지 못한다 — 그때 직접 해제 안내로 떨어진다.
      this.logger.warn('네이버 응답에 refresh_token 이 없습니다 — 탈퇴 시 연결 해제 불가.');
    }
    return { accessToken: data.access_token, refreshToken: data.refresh_token ?? null };
  }

  /**
   * 회원 프로필 조회.
   *
   * 식별자(`id`)가 Account.providerId 가 된다 — 우리 액세스 토큰으로 직접 부른 응답이라
   * 신뢰할 수 있다. 네이버 식별자는 숫자가 아니라 영숫자 문자열이다.
   */
  private async requestProfile(accessToken: string): Promise<Omit<NaverProfile, 'refreshToken'>> {
    const res = await fetch(PROFILE_ENDPOINT, {
      method: 'GET',
      headers: { authorization: `Bearer ${accessToken}` },
    }).catch((error: unknown) => {
      this.logger.error(`네이버 사용자 조회 실패: ${String(error)}`);
      return null;
    });

    if (!res) {
      throw new ServiceUnavailableException('네이버 인증 서버에 연결할 수 없습니다.');
    }
    if (!res.ok) {
      this.logger.warn(`네이버 사용자 조회 실패 (${res.status}): ${await res.text()}`);
      throw new UnauthorizedException('네이버 계정 정보를 불러올 수 없습니다.');
    }

    const data = (await res.json()) as {
      resultcode?: string;
      message?: string;
      response?: NaverProfileResponse;
    };

    // 네이버는 조회에 실패해도 HTTP 200 으로 주고 resultcode 로만 알린다 ("00" 이 성공).
    if (data.resultcode !== '00' || !data.response) {
      this.logger.warn(
        `네이버 사용자 조회 응답 오류 (resultcode=${data.resultcode ?? '없음'}): ${data.message ?? ''}`,
      );
      throw new UnauthorizedException('네이버 계정 정보를 불러올 수 없습니다.');
    }

    const profile = data.response;
    const sub = profile.id?.trim() ?? '';
    if (!sub) {
      throw new UnauthorizedException('네이버 계정 식별자를 받지 못했습니다.');
    }

    const name = profile.name?.trim() ?? '';
    if (!name) {
      // 회원이름은 '필수' 제공이라 여기까지 왔으면 늘 있다 — 없다면 콘솔 제공 정보가 꺼진 것이다.
      throw new UnauthorizedException('네이버 계정 정보를 불러올 수 없습니다.');
    }

    return {
      sub: sub.slice(0, 255),
      email: profile.email?.trim() || null,
      name,
      phone: parsePhone(profile),
      gender: parseGender(profile.gender),
      ageRange: profile.age?.trim().slice(0, 20) || null,
      birthday: parseBirthday(profile),
      consents: this.parseConsents(profile),
    };
  }

  /**
   * '네이버 로그인 플러스' 정보제공동의 화면에서 받은 약관 동의 내역.
   *
   * ⚠️ 네이버는 이 내역의 응답 형식을 공개 문서에 명시하지 않는다. 그래서 프로필 응답에서
   * 약관 배열로 보이는 필드를 찾아 읽고, **없으면 빈 배열로 넘어간다**(로그인을 막지 않는다).
   * 그 경우 동의는 기록되지 않고 앱의 동의 바에서 SELF 로 다시 받게 되므로, 사용자가 네이버
   * 화면에서 동의한 것이 헛되지는 않아도 한 번 더 묻게 된다.
   *
   * 첫 실제 로그인 때 아래 warn 로그에 찍힌 응답 키를 보고 필드명을 확정할 것.
   */
  private parseConsents(profile: NaverProfileResponse): ProviderConsent[] {
    const raw = profile.terms ?? profile.agreements ?? profile.term_agreements;

    if (!Array.isArray(raw)) {
      // 약관 배열을 찾지 못했다 — 어떤 키로 오는지 확인할 수 있게 키 목록만 남긴다(값은 개인정보).
      if (!this.warnedMissingTerms) {
        this.warnedMissingTerms = true;
        this.logger.warn(
          `네이버 약관 동의 내역을 찾지 못했습니다. 응답 키: ${Object.keys(profile).join(', ')}`,
        );
      }
      return [];
    }

    const consents: ProviderConsent[] = [];
    for (const term of raw) {
      // 태그 키도 문서화돼 있지 않아 흔한 이름을 모두 본다.
      const tag = String(term?.code ?? term?.tag ?? term?.termCode ?? '').trim();
      if (!tag) continue;

      const type = mapConsentTag(tag);
      // 우리 동의 항목이 아닌 태그는 무시한다.
      if (!type) continue;

      const agreed = term.agreed === true || term.agreed === 'Y';
      consents.push({
        type,
        tag: tag.slice(0, 100),
        agreed,
        agreedAt: agreed ? parseAgreedAt(term.agreedAt ?? term.agreed_at) : null,
      });
    }

    return dedupeConsents(consents);
  }
}

/** 토큰 엔드포인트 응답 — 발급·재발급·연결 해제가 모두 같은 형태로 온다 */
interface NaverTokenResponse {
  access_token?: string;
  /** 액세스 토큰은 한 시간이면 만료되므로 탈퇴용으로는 이것을 보관한다 */
  refresh_token?: string;
  /** `grant_type=delete` 성공 시 "success" */
  result?: string;
  error?: string;
}

/** `/v1/nid/me` 의 response 중 우리가 쓰는 부분 */
interface NaverProfileResponse {
  /** 네이버 회원 식별자 — 영숫자 문자열 */
  id?: string;
  /** 회원이름 — 필수 제공 */
  name?: string;
  /** 연락처 이메일 주소 — 추가 제공 */
  email?: string;
  /** "F" | "M" | "U"(확인불가) */
  gender?: string;
  /** "20-29" 형태 */
  age?: string;
  /** "MM-DD" — 연도는 birthyear 로 따로 온다 */
  birthday?: string;
  /** "YYYY" */
  birthyear?: string;
  /** "010-1234-5678" */
  mobile?: string;
  /** "+821012345678" — mobile 보다 형식이 일정해 이것을 먼저 본다 */
  mobile_e164?: string;
  /** 네이버 로그인 플러스 약관 동의 내역 — 문서화돼 있지 않아 후보 키를 모두 둔다 */
  terms?: NaverTerm[];
  agreements?: NaverTerm[];
  term_agreements?: NaverTerm[];
}

interface NaverTerm {
  code?: string;
  tag?: string;
  termCode?: string;
  /** boolean 또는 "Y"/"N" */
  agreed?: boolean | string;
  agreedAt?: string;
  agreed_at?: string;
}

/**
 * 네이버는 휴대전화번호를 `"010-1234-5678"`(mobile)과 `"+821012345678"`(mobile_e164)로 준다.
 * User.phone 은 숫자만 보관하므로(`01012345678`) 국내 번호만 바꿔 담고,
 * 해외 번호는 형식이 제각각이라 받지 않는다.
 */
function parsePhone(profile: NaverProfileResponse): string | null {
  const raw = profile.mobile_e164?.trim() || profile.mobile?.trim();
  if (!raw) return null;

  const digits = raw.replace(/\D/g, '');
  // +82 10-1234-5678 → 821012345678 → 앞의 82 를 0 으로 되돌린다
  const local = digits.startsWith('82') ? `0${digits.slice(2)}` : digits;

  return /^01[016789]\d{7,8}$/.test(local) ? local : null;
}

function parseGender(value?: string): Gender | null {
  // 네이버는 F/M 외에 "U"(확인 불가)를 주는데, 이것은 성별을 모른다는 뜻이라 담지 않는다.
  if (value === 'M') return 'MALE';
  if (value === 'F') return 'FEMALE';
  return null;
}

/**
 * 네이버는 생일을 "MM-DD"(birthday)와 "YYYY"(birthyear)로 나눠 준다.
 * 둘 다 제공에 동의해야 날짜 하나를 만들 수 있다.
 */
function parseBirthday(profile: NaverProfileResponse): Date | null {
  const mmdd = profile.birthday?.trim();
  const year = profile.birthyear?.trim();

  if (!mmdd || !year) return null;
  if (!/^\d{2}-\d{2}$/.test(mmdd) || !/^\d{4}$/.test(year)) return null;

  const month = Number(mmdd.slice(0, 2));
  const day = Number(mmdd.slice(3, 5));
  // @db.Date 컬럼 — 시간대에 따라 날짜가 하루 밀리지 않도록 UTC 자정으로 만든다.
  const date = new Date(Date.UTC(Number(year), month - 1, day));

  // 2월 30일처럼 존재하지 않는 날짜는 Date 가 다음 달로 넘겨버리므로 되돌려 확인한다.
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}

/**
 * 네이버가 준 동의 시각. 형식이 어긋나거나 오지 않으면 null 을 돌려주고,
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
  return randomBytes(bytes).toString('base64url');
}
