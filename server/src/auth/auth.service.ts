import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../common/prisma/prisma.service';
import { BUCKET, SupabaseService } from '../common/supabase/supabase.service';
import { ConsentSource, ConsentType, ProviderType, UserStatus } from '../generated/prisma/enums';
import type { Gender } from '../generated/prisma/enums';
import { KakaoOAuthService } from './kakao-oauth.service';
import { NaverOAuthService } from './naver-oauth.service';
import type { ProviderConsent } from './provider-consent';
import { TokenCipherService } from './token-cipher.service';
import { UpdateConsentsDto } from './dto/update-consents.dto';

/** 제공자에 관계없이 로그인에 필요한 프로필 */
interface SnsProfile {
  providerType: ProviderType;
  /** 제공자가 발급한 고유 회원번호 */
  providerId: string;
  /** 선택 동의 — 카카오·네이버 모두 거부하면 주지 않는다. */
  email: string | null;
  /** 필수 동의 — 카카오·네이버 모두 항상 준다. */
  name: string;
  /** 필수 동의 — 다만 해외 번호처럼 우리가 담을 수 없는 형식이면 비어 있다. */
  phone?: string | null;
  /** 아래 3개는 선택 동의 항목이라 제공자가 동의를 받지 못하면 null 이다. */
  gender?: Gender | null;
  ageRange?: string | null;
  birthday?: Date | null;
  /**
   * 제공자의 간편가입 동의화면에서 받아 온 약관 동의 내역.
   * 카카오는 서비스 약관 API, 네이버는 '네이버 로그인 플러스' 로 받는다.
   */
  consents: ProviderConsent[];
  /** 위 동의를 어디서 받았는지 (ConsentLog.source 로 남는다) */
  consentSource: ConsentSource;
  /**
   * 제공자가 준 갱신 토큰 — 탈퇴할 때 연결 해제에만 쓴다 (암호화해 accounts 에 보관).
   * 네이버만 필요하다. 카카오는 어드민 키로 끊으므로 비워 둔다.
   */
  refreshToken?: string | null;
}

export interface UserJwtPayload {
  sub: string;
  /** 선택 수집이라 비어 있을 수 있다 — 식별에는 sub 만 쓴다. */
  email: string | null;
  role: 'USER' | 'ADMIN';
}

export interface AuthSession {
  accessToken: string;
  /** epoch seconds — 프론트가 쿠키 만료를 JWT 와 맞추는 데 사용 */
  expiresAt: number;
  user: SessionUser;
}

/**
 * 세션에 실리는 사용자.
 * `phone` 이 null 이면 가입이 끝나지 않은 상태라 프론트가 연락처 입력 화면으로 보낸다.
 */
export interface SessionUser {
  id: string;
  /** 선택 동의 — 제공자에게 받지 못하면 null */
  email: string | null;
  name: string;
  phone: string | null;
  role: 'USER' | 'ADMIN';
}

const USER_FIELDS = {
  id: true,
  email: true,
  name: true,
  phone: true,
  role: true,
  status: true,
} as const;

/** 동의 상태 조회에 필요한 컬럼 */
const CONSENT_FIELDS = {
  termsAgreedAt: true,
  privacyAgreedAt: true,
  marketingAgreedAt: true,
  marketingExpiresAt: true,
  thirdPartyAgreedAt: true,
  termsConsentSource: true,
  privacyConsentSource: true,
  marketingConsentSource: true,
  thirdPartyConsentSource: true,
} as const;

/** 마케팅 동의 유효기간 — 개인정보보호법 시행령 §48조의2 (2년마다 재확인) */
const MARKETING_CONSENT_VALIDITY_YEARS = 2;

function calcMarketingExpiresAt(from: Date): Date {
  const expires = new Date(from);
  expires.setFullYear(expires.getFullYear() + MARKETING_CONSENT_VALIDITY_YEARS);
  return expires;
}

/** users 의 동의 컬럼 — 항목별로 '동의 시각 + 출처' 가 짝으로 움직인다 */
interface ConsentColumns {
  termsAgreedAt?: Date | null;
  termsConsentSource?: ConsentSource | null;
  privacyAgreedAt?: Date | null;
  privacyConsentSource?: ConsentSource | null;
  marketingAgreedAt?: Date | null;
  marketingConsentSource?: ConsentSource | null;
  marketingExpiresAt?: Date | null;
  thirdPartyAgreedAt?: Date | null;
  thirdPartyConsentSource?: ConsentSource | null;
}

/** consent_logs 한 줄 (append-only 증빙) */
interface ConsentLogRow {
  type: ConsentType;
  agreed: boolean;
  source: ConsentSource;
  providerTag: string | null;
  createdAt: Date;
}

/**
 * 항목 하나의 동의 컬럼을 채운다.
 * agreedAt 이 null 이면 미동의(또는 철회)라 출처도 함께 지운다.
 */
function setConsentColumns(
  columns: ConsentColumns,
  type: ConsentType,
  agreedAt: Date | null,
  source: ConsentSource,
): void {
  const appliedSource = agreedAt ? source : null;

  switch (type) {
    case ConsentType.TERMS:
      columns.termsAgreedAt = agreedAt;
      columns.termsConsentSource = appliedSource;
      break;
    case ConsentType.PRIVACY:
      columns.privacyAgreedAt = agreedAt;
      columns.privacyConsentSource = appliedSource;
      break;
    case ConsentType.MARKETING:
      columns.marketingAgreedAt = agreedAt;
      columns.marketingConsentSource = appliedSource;
      // 만료는 '동의한 시점' 부터 2년이다 — 제공자가 알려준 동의 시각을 그대로 기준으로 쓴다.
      columns.marketingExpiresAt = agreedAt ? calcMarketingExpiresAt(agreedAt) : null;
      break;
    case ConsentType.THIRD_PARTY:
      columns.thirdPartyAgreedAt = agreedAt;
      columns.thirdPartyConsentSource = appliedSource;
      break;
  }
}

/** 선택 동의 항목이 이미 채워져 있는지 판단하기 위해 함께 읽는다 */
const USER_WITH_OPTIONAL_FIELDS = {
  ...USER_FIELDS,
  gender: true,
  ageRange: true,
  birthday: true,
} as const;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly kakao: KakaoOAuthService,
    private readonly naver: NaverOAuthService,
    private readonly cipher: TokenCipherService,
    private readonly supabase: SupabaseService,
  ) {}

  /** 로그인 시작 — 프론트는 url 로 이동시키고 나머지 값은 httpOnly 쿠키에 보관한다. */
  createKakaoAuthorizeRequest() {
    return this.kakao.createAuthorizeRequest();
  }

  /** 카카오 콜백 — code 를 프로필로 교환하고 세션(JWT)을 발급한다. */
  async loginWithKakao(code: string, codeVerifier: string): Promise<AuthSession> {
    const { sub, email, name, phone, gender, ageRange, birthday, consents } =
      await this.kakao.exchangeCodeForProfile(code, codeVerifier);
    return this.login({
      providerType: ProviderType.KAKAO,
      providerId: sub,
      email,
      name,
      phone,
      gender,
      ageRange,
      birthday,
      consents,
      consentSource: ConsentSource.KAKAO,
    });
  }

  /** 로그인 시작 — 프론트는 url 로 이동시키고 state 는 httpOnly 쿠키에 보관한다. */
  createNaverAuthorizeRequest() {
    return this.naver.createAuthorizeRequest();
  }

  /** 네이버 콜백 — code 를 프로필로 교환하고 세션(JWT)을 발급한다. */
  async loginWithNaver(code: string, state: string): Promise<AuthSession> {
    const { sub, email, name, phone, gender, ageRange, birthday, consents, refreshToken } =
      await this.naver.exchangeCodeForProfile(code, state);
    return this.login({
      providerType: ProviderType.NAVER,
      providerId: sub,
      email,
      name,
      phone,
      gender,
      ageRange,
      birthday,
      consents,
      consentSource: ConsentSource.NAVER,
      refreshToken,
    });
  }

  private async login(profile: SnsProfile): Promise<AuthSession> {
    const user = await this.findOrCreateUser(profile);

    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('이용이 제한된 계정입니다.');
    }

    return this.issueSession(user);
  }

  /** 세션 확인 — 토큰이 유효해도 그 사이 정지·탈퇴됐을 수 있으므로 DB 상태까지 본다. */
  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: USER_FIELDS,
    });

    if (!user || user.status !== UserStatus.ACTIVE) return null;
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
    };
  }

  /**
   * 내 정보 — 마이페이지 '내 정보' 화면이 읽는다.
   *
   * 세션(getMe)과 따로 둔다. 세션은 "누가 로그인했는가"라서 모든 페이지가 부르는데,
   * 성별·생일 같은 수집 항목까지 거기 실으면 볼 필요 없는 화면까지 개인정보를 끌고 다닌다.
   */
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        status: true,
        email: true,
        name: true,
        phone: true,
        gender: true,
        ageRange: true,
        birthday: true,
      },
    });

    if (!user || user.status !== UserStatus.ACTIVE) return null;

    return {
      email: user.email,
      name: user.name,
      phone: user.phone,
      gender: user.gender,
      ageRange: user.ageRange,
      birthday: user.birthday,
    };
  }

  /** 항목별 동의 상태 — 마이페이지 약관 화면이 읽는다. */
  async getConsents(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: CONSENT_FIELDS,
    });
    if (!user) throw new NotFoundException('사용자를 찾을 수 없습니다.');

    // 만료된 마케팅 동의는 살아 있다고 보여주지 않는다 (재동의를 받아야 하므로).
    const marketingExpired = !!user.marketingExpiresAt && user.marketingExpiresAt < new Date();

    return {
      terms: {
        agreed: !!user.termsAgreedAt,
        agreedAt: user.termsAgreedAt,
        source: user.termsConsentSource,
      },
      privacy: {
        agreed: !!user.privacyAgreedAt,
        agreedAt: user.privacyAgreedAt,
        source: user.privacyConsentSource,
      },
      marketing: {
        agreed: !!user.marketingAgreedAt && !marketingExpired,
        agreedAt: user.marketingAgreedAt,
        expiresAt: user.marketingExpiresAt,
        expired: marketingExpired,
        source: user.marketingConsentSource,
      },
      thirdParty: {
        agreed: !!user.thirdPartyAgreedAt,
        agreedAt: user.thirdPartyAgreedAt,
        source: user.thirdPartyConsentSource,
      },
    };
  }

  /**
   * 회원 탈퇴.
   *
   * **행을 지우지 않고 개인정보만 파기한다.** 결제 내역은 전자상거래법 제6조(대금 결제·재화
   * 공급 기록 5년)상 보관해야 하는데, users 를 삭제하면 membership_orders 가 Cascade 로
   * 함께 사라지기 때문이다. 그래서 식별 정보를 지우고 status 만 DELETED 로 바꾼다.
   *
   * - 식별 정보(email·name·phone)와 선택 수집 항목(gender·ageRange·birthday) 파기
   * - 제공자(카카오) 쪽 앱 연결까지 해제하고 accounts 삭제 —
   *   다시 로그인하면 동의화면부터 새로 뜨고 새 회원으로 가입된다
   * - 챌린지 기록과 인증 사진 삭제 (보존 의무가 없는 활동 기록)
   * - 살아 있던 동의는 모두 철회하고 이력을 한 줄씩 남긴다
   *
   * 탈퇴 후에는 JWT 가 남아 있어도 getMe 가 ACTIVE 만 통과시키므로 세션이 곧바로 끊긴다.
   *
   * @returns `manualDisconnect` — 우리가 끊지 못해 사용자가 직접 해제해야 하는 제공자.
   *          화면에서 안내해야 한다. 비어 있으면 모두 끊긴 것이다.
   */
  async withdraw(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { status: true, ...CONSENT_FIELDS },
    });
    if (!user) throw new NotFoundException('사용자를 찾을 수 없습니다.');
    if (user.status === UserStatus.DELETED) {
      throw new BadRequestException('이미 탈퇴한 계정입니다.');
    }

    // 외부에 남는 것부터 정리한다 — DB 를 먼저 지우면 연결을 끊을 열쇠(회원번호·토큰)와
    // 사진 경로를 잃어버려 제공자 쪽 연결과 파일이 영영 남는다.
    // 둘 다 실패해도 로그만 남기고 진행한다 (탈퇴는 사용자의 권리라 외부 장애로 막으면 안 된다).
    const manualDisconnect = await this.disconnectProviders(userId);
    await this.removeChallengeProofs(userId);

    const now = new Date();
    const columns: ConsentColumns = {};
    const logs: ConsentLogRow[] = [];
    const current: [type: ConsentType, agreedAt: Date | null][] = [
      [ConsentType.TERMS, user.termsAgreedAt],
      [ConsentType.PRIVACY, user.privacyAgreedAt],
      [ConsentType.MARKETING, user.marketingAgreedAt],
      [ConsentType.THIRD_PARTY, user.thirdPartyAgreedAt],
    ];

    for (const [type, agreedAt] of current) {
      setConsentColumns(columns, type, null, ConsentSource.SELF);
      // 살아 있던 동의만 '철회' 로 남긴다 (애초에 동의하지 않은 항목까지 남기면 이력이 지저분해진다).
      if (!agreedAt) continue;
      logs.push({
        type,
        agreed: false,
        source: ConsentSource.SELF,
        providerTag: null,
        createdAt: now,
      });
    }

    await this.prisma.$transaction(async (tx) => {
      // 활동 기록은 보존 의무가 없다 — 그룹을 지우면 items 는 Cascade 로 함께 지워진다.
      await tx.challengeGroup.deleteMany({ where: { userId } });
      if (logs.length > 0) {
        await tx.consentLog.createMany({ data: logs.map((log) => ({ ...log, userId })) });
      }
      // 연결을 끊어야 같은 SNS 계정으로 새로 가입할 수 있다 (accounts 는 (제공자, 회원번호) unique).
      await tx.account.deleteMany({ where: { userId } });
      await tx.user.update({
        where: { id: userId },
        data: {
          status: UserStatus.DELETED,
          email: null,
          name: '탈퇴한 회원',
          phone: null,
          gender: null,
          ageRange: null,
          birthday: null,
          ...columns,
        },
      });
    });

    return { ok: true, manualDisconnect };
  }

  /**
   * 탈퇴 시 제공자 쪽 앱 연결 해제.
   *
   * 이걸 하지 않으면 우리 DB 에서만 지워지고 카카오 계정에는 picky 권한이 남아,
   * 다시 로그인할 때 동의화면 없이 바로 통과한다(사용자에게는 '탈퇴가 안 된' 것처럼 보인다).
   *
   * - 카카오: 어드민 키 + 회원번호로 unlink. 토큰이 필요 없다.
   * - 네이버: 끊을 수 없다. 해제 API 가 그 사용자의 액세스 토큰을 요구하는데 우리는 토큰을
   *   보관하지 않는다(카카오의 어드민 키에 해당하는 것도 없다). 항상 manualDisconnect 로 나간다.
   *
   * @returns 끊지 못한 제공자 목록 — 사용자가 직접 해제해야 한다.
   */
  private async disconnectProviders(userId: string): Promise<ProviderType[]> {
    const accounts = await this.prisma.account.findMany({
      where: { userId },
      select: { providerType: true, providerId: true, refreshToken: true },
    });

    const failed: ProviderType[] = [];

    for (const account of accounts) {
      let disconnected = false;

      switch (account.providerType) {
        case ProviderType.KAKAO:
          disconnected = await this.kakao.unlink(account.providerId);
          break;
        case ProviderType.NAVER:
          // 보관해 둔 갱신 토큰으로 끊는다. 토큰이 없거나(옛 계정) 네이버가 거절하면 false 가
          // 되어 사용자가 [네이버 내정보 > 보안설정 > 연결된 서비스 관리]에서 직접 끊게 된다.
          disconnected = await this.naver.unlink(
            account.refreshToken ? this.cipher.decrypt(account.refreshToken) : null,
          );
          break;
        default:
          // 구글 로그인은 제거했다 — 예전에 가입한 계정이 남아 있으면 우리가 끊을 수 없으므로
          // manualDisconnect 로 내보내 사용자가 직접 해제하도록 안내한다.
          this.logger.warn(`연결 해제가 구현되지 않은 제공자: ${account.providerType}`);
      }

      if (!disconnected) {
        this.logger.warn(
          `${account.providerType} 연결 해제 실패 (user=${userId}) — 직접 해제 안내`,
        );
        failed.push(account.providerType);
      }
    }

    return failed;
  }

  /** 탈퇴 시 인증 사진 파기 — private 버킷이라 남겨 두면 계속 보관하는 셈이 된다. */
  private async removeChallengeProofs(userId: string) {
    const items = await this.prisma.challengeGroupItem.findMany({
      where: { group: { userId }, proofImagePath: { not: null } },
      select: { proofImagePath: true },
    });
    if (items.length === 0) return;

    await this.supabase.removeFrom(
      BUCKET.proofs,
      items.map((item) => item.proofImagePath!),
    );
  }

  /**
   * 동의 변경 — 보낸 항목만 바꾸고, 바뀐 항목마다 이력을 한 줄씩 남긴다.
   * 필수 동의는 DTO 가 true 만 허용하므로 여기서 철회가 들어올 일은 없다.
   */
  async updateConsents(userId: string, dto: UpdateConsentsDto) {
    const now = new Date();
    const columns: ConsentColumns = {};
    // 우리 화면에서 직접 받은 동의라 출처는 SELF 다 (SNS 에서 받아 온 것과 구분된다).
    const logs: ConsentLogRow[] = [];

    const changes: [type: ConsentType, agreed: boolean | undefined][] = [
      [ConsentType.TERMS, dto.terms],
      [ConsentType.PRIVACY, dto.privacy],
      [ConsentType.MARKETING, dto.marketing],
      [ConsentType.THIRD_PARTY, dto.thirdParty],
    ];

    for (const [type, agreed] of changes) {
      if (typeof agreed !== 'boolean') continue;
      setConsentColumns(columns, type, agreed ? now : null, ConsentSource.SELF);
      logs.push({ type, agreed, source: ConsentSource.SELF, providerTag: null, createdAt: now });
    }

    if (logs.length === 0) {
      throw new BadRequestException('변경할 동의 항목이 없습니다.');
    }

    // 동의 시각과 이력이 어긋나면 증빙이 되지 않으므로 한 트랜잭션으로 묶는다.
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: columns });
      await tx.consentLog.createMany({ data: logs.map((log) => ({ ...log, userId })) });
    });

    return this.getConsents(userId);
  }

  /**
   * (제공자, 회원번호) 로 기존 연결을 먼저 찾고, 없으면 **연락처가 같은 회원**에 계정을
   * 덧붙이거나(다른 제공자로 먼저 가입한 경우) 새 회원을 만든다.
   *
   * 회원을 묶는 기준은 연락처다 — 카카오·네이버 모두 필수 동의로 받고 통신사에서 본인확인된
   * 번호라, 성격이 제각각인 이메일보다 믿을 수 있다(그래서 User.email 은 unique 가 아니다).
   *
   * 번호를 받지 못했으면(해외 번호·동의 거부) 묶을 근거가 없으므로 별도 회원이 된다.
   */
  private async findOrCreateUser(profile: SnsProfile) {
    const { providerType, providerId, email, name, phone, gender, ageRange, birthday } = profile;

    const linked = await this.prisma.account.findUnique({
      where: { providerType_providerId: { providerType, providerId } },
      select: { user: { select: USER_WITH_OPTIONAL_FIELDS } },
    });
    if (linked) {
      // 로그인할 때마다 최신 토큰으로 갈아 끼운다 — 오래된 것은 탈퇴 시점에 이미 만료돼 있다.
      await this.rememberRefreshToken(profile);
      await this.syncProviderConsents(linked.user.id, profile);
      return this.fillMissingProfile(linked.user, profile);
    }

    // 이 제공자 계정으로는 처음이다 — 다른 제공자로 먼저 가입했는지 연락처로 확인한다.
    // 탈퇴한 회원은 phone 을 비워 두므로(withdraw) 여기 걸리지 않는다.
    const sameUser = phone
      ? await this.prisma.user.findFirst({
          where: { phone, status: { not: UserStatus.DELETED } },
          select: USER_WITH_OPTIONAL_FIELDS,
        })
      : null;

    if (sameUser) {
      // 같은 사람이다 — 새 회원을 만들지 않고 이 회원에 계정을 하나 더 단다.
      // (한 회원이 같은 제공자를 두 번 달 수는 없다 — accounts 의 (userId, providerType) unique)
      await this.prisma.account.create({
        data: { userId: sameUser.id, providerType, providerId, refreshToken: this.seal(profile) },
      });
      await this.syncProviderConsents(sameUser.id, profile);
      return this.fillMissingProfile(sameUser, profile);
    }

    const { columns, logs } = this.buildSignupConsents(profile);

    return this.prisma.user.create({
      data: {
        email,
        name,
        // 동의를 받지 못한 항목은 null 로 남는다 (스키마가 모두 nullable).
        phone: phone ?? null,
        gender: gender ?? null,
        ageRange: ageRange ?? null,
        birthday: birthday ?? null,
        ...columns,
        accounts: { create: { providerType, providerId, refreshToken: this.seal(profile) } },
        consentLogs: { create: logs },
      },
      select: USER_FIELDS,
    });
  }

  /** 보관할 갱신 토큰 — 제공자가 주지 않았으면(카카오 등) null 이다. */
  private seal(profile: SnsProfile): string | null {
    return profile.refreshToken ? this.cipher.encrypt(profile.refreshToken) : null;
  }

  /**
   * 이미 연결된 계정의 갱신 토큰 갱신.
   * 토큰을 받지 못한 로그인이라면 그냥 둔다 — 있던 값을 null 로 덮으면 끊을 열쇠를 잃는다.
   */
  private async rememberRefreshToken(profile: SnsProfile) {
    const sealed = this.seal(profile);
    if (!sealed) return;

    await this.prisma.account.update({
      where: {
        providerType_providerId: {
          providerType: profile.providerType,
          providerId: profile.providerId,
        },
      },
      data: { refreshToken: sealed },
    });
  }

  /**
   * 가입 시점의 동의 컬럼·이력.
   *
   * **제공자가 알려준 것만 기록한다.** 동의는 제공자의 간편가입 동의화면에서만 받는다 —
   * 우리 동의 화면은 없앴다.
   *
   * 주지 않은 항목은 비워 둔다. 있지도 않은 동의를 SELF 로 적어 넣으면 근거 없는 기록이 되므로,
   * 차라리 비워 두고 마이페이지에서 받는다. 카카오는 약관 조회 API 가 있어 늘 채워지지만,
   * 네이버는 로그인 플러스 응답 형식이 문서화돼 있지 않아 비어 올 수 있다 — 그때 이 경로를 탄다.
   */
  private buildSignupConsents(profile: SnsProfile): {
    columns: ConsentColumns;
    logs: ConsentLogRow[];
  } {
    const { consents, consentSource } = profile;
    const now = new Date();
    const columns: ConsentColumns = {};
    const logs: ConsentLogRow[] = [];

    for (const consent of consents) {
      // 동의 시각을 주지 않았으면 가입 시각으로 본다 (동의 사실 자체는 제공자가 보증한다).
      const agreedAt = consent.agreed ? (consent.agreedAt ?? now) : null;
      setConsentColumns(columns, consent.type, agreedAt, consentSource);
      logs.push({
        type: consent.type,
        agreed: consent.agreed,
        source: consentSource,
        providerTag: consent.tag,
        // 미동의는 '지금 거부했다' 는 기록이라 가입 시각으로 남긴다.
        createdAt: agreedAt ?? now,
      });
    }

    return { columns, logs };
  }

  /**
   * 이미 가입한 사용자의 동의를 제공자 쪽 내역과 맞춘다 (로그인할 때마다).
   *
   * **새로 동의한 것만 반영하고, 철회는 절대 따라가지 않는다.** 제공자가 "동의 안 함" 으로 주는
   * 경우는 (가) 그 화면에서 거부했거나 (나) 우리 앱에서만 동의한 경우인데, 제공자는 철회 시각을
   * 주지 않아 둘을 구분할 수 없다. 따라가면 앱에서 켠 동의가 로그인할 때마다 꺼져 버린다.
   *
   * 반대 방향도 막아야 한다 — 앱에서 철회한 항목을 제공자의 옛 동의 기록으로 되살리면 안 되므로,
   * 마지막 이력보다 **나중에** 받은 동의만 반영한다.
   */
  private async syncProviderConsents(userId: string, profile: SnsProfile): Promise<void> {
    const agreedConsents = profile.consents.filter((consent) => consent.agreed);
    if (agreedConsents.length === 0) return;

    const types = agreedConsents.map((consent) => consent.type);
    // 항목별 마지막 이력 시각 — 동의든 철회든 컬럼이 바뀔 때마다 한 줄씩 쌓이므로 이것만 보면 된다.
    // (인덱스 [userId, type, createdAt] 가 그대로 탄다)
    const latestLogs = await this.prisma.consentLog.groupBy({
      by: ['type'],
      where: { userId, type: { in: types } },
      _max: { createdAt: true },
    });
    const lastChangedAt = new Map(latestLogs.map((log) => [log.type, log._max.createdAt]));

    const now = new Date();
    const columns: ConsentColumns = {};
    const logs: ConsentLogRow[] = [];

    for (const consent of agreedConsents) {
      const lastChanged = lastChangedAt.get(consent.type);
      // 이미 이력이 있는데 (가) 제공자가 동의 시각을 주지 않았거나 (나) 우리 기록이 더 최신이면
      // 손대지 않는다. 시각 없이 now 로 반영하면 같은 동의가 로그인할 때마다 새 이력으로 쌓인다.
      if (lastChanged && (!consent.agreedAt || lastChanged >= consent.agreedAt)) continue;

      const agreedAt = consent.agreedAt ?? now;
      setConsentColumns(columns, consent.type, agreedAt, profile.consentSource);
      logs.push({
        type: consent.type,
        agreed: true,
        source: profile.consentSource,
        providerTag: consent.tag,
        createdAt: agreedAt,
      });
    }

    if (logs.length === 0) return;

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: columns });
      await tx.consentLog.createMany({ data: logs.map((log) => ({ ...log, userId })) });
    });
  }

  /**
   * 비어 있는 프로필 값을 로그인할 때마다 채운다.
   * 나중에 동의한 선택 항목이 들어오기도 하고, 다른 제공자가 우리가 못 받은 값을 주기도 한다.
   *
   * 이미 값이 있으면 덮지 않는다 — 사용자가 동의를 철회해 null 이 와도 기존 값을 지우지 않기 위해서다.
   * 채울 것이 없으면 쓰기 쿼리를 보내지 않는다.
   */
  private async fillMissingProfile(
    user: {
      id: string;
      email: string | null;
      name: string;
      phone: string | null;
      role: 'USER' | 'ADMIN';
      status: UserStatus;
      gender: Gender | null;
      ageRange: string | null;
      birthday: Date | null;
    },
    profile: SnsProfile,
  ) {
    const data: {
      email?: string;
      phone?: string;
      gender?: Gender;
      ageRange?: string;
      birthday?: Date;
    } = {};

    // 처음 로그인 때 동의하지 않은 항목을 나중에 동의하면 그때 채워진다.
    // email 은 unique 가 아니라 phone 처럼 충돌을 확인할 필요가 없다.
    if (user.email === null && profile.email != null) data.email = profile.email;
    if (user.phone === null && profile.phone != null) {
      // phone 은 unique(회원 식별 기준)다. 이 회원이 번호 없이 가입한 사이에 같은 번호로
      // 다른 회원이 생겼을 수 있는데, 그대로 채우면 제약에 걸려 로그인이 통째로 실패한다.
      // 비워 둔 채 넘어가고 경고만 남긴다 — 한 사람이 회원 둘로 갈린 상태라 운영에서 확인해야 한다.
      const taken = await this.prisma.user.findFirst({
        where: { phone: profile.phone, id: { not: user.id } },
        select: { id: true },
      });

      if (taken) {
        this.logger.warn(
          `연락처가 다른 회원(${taken.id})에 이미 있어 채우지 않는다 (user=${user.id})`,
        );
      } else {
        data.phone = profile.phone;
      }
    }

    if (user.gender === null && profile.gender != null) data.gender = profile.gender;
    if (user.ageRange === null && profile.ageRange != null) data.ageRange = profile.ageRange;
    if (user.birthday === null && profile.birthday != null) data.birthday = profile.birthday;

    if (Object.keys(data).length === 0) {
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: user.role,
        status: user.status,
      };
    }

    return this.prisma.user.update({
      where: { id: user.id },
      data,
      select: USER_FIELDS,
    });
  }

  private issueSession(user: SessionUser): AuthSession {
    const payload: UserJwtPayload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = this.jwt.sign(payload);
    const { exp } = this.jwt.decode<{ exp: number }>(accessToken);

    return {
      accessToken,
      expiresAt: exp,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: user.role,
      },
    };
  }
}
