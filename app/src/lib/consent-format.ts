// 동의 상태의 타입 — 서버 컴포넌트와 클라이언트 컴포넌트가 함께 쓴다.
// next/headers 를 쓰는 서버 전용 조회는 `lib/consents.ts`, 변경용 훅은 `lib/use-consents.ts` 에 있다.

export type ConsentKey = 'terms' | 'privacy' | 'marketing' | 'thirdParty';
/** 동의만 받는 항목 — 철회하면 서비스를 쓸 수 없어 회원 탈퇴로만 거둘 수 있다 */
export type RequiredConsentKey = 'terms' | 'privacy';
/** 켜고 끌 수 있는 항목 */
export type OptionalConsentKey = 'marketing' | 'thirdParty';

/** 동의를 어디서 받았는지 — SELF 는 우리 화면, 나머지는 SNS 간편가입 동의화면 */
export type ConsentSource = 'SELF' | 'KAKAO' | 'NAVER';

export type ConsentState = {
  agreed: boolean;
  agreedAt: string | null;
  /** 동의한 적이 없으면 null */
  source: ConsentSource | null;
};
export type MarketingConsentState = ConsentState & {
  expiresAt: string | null;
  expired: boolean;
};

export type Consents = {
  terms: ConsentState;
  privacy: ConsentState;
  marketing: MarketingConsentState;
  thirdParty: ConsentState;
};
