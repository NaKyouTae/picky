// 동의 상태의 타입과 표시용 포맷터 — 서버 컴포넌트와 클라이언트 컴포넌트가 함께 쓴다.
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

const SOURCE_LABEL: Record<ConsentSource, string> = {
  SELF: '앱에서 동의',
  KAKAO: '카카오에서 동의',
  NAVER: '네이버에서 동의',
};

/**
 * "2026. 09. 22. 카카오에서 동의" — 마이페이지·약관 화면에 그대로 쓴다.
 * 동의한 적이 없으면 "아직 동의하지 않았어요".
 */
export function formatConsentStatus(state: ConsentState | undefined): string {
  if (!state) return '';
  if (!state.agreed) return '아직 동의하지 않았어요';

  const date = formatDate(state.agreedAt);
  const label = SOURCE_LABEL[state.source ?? 'SELF'];
  // 동의 시각을 받지 못한 예전 기록도 있으므로 날짜가 없으면 출처만 보여 준다.
  return date ? `${date} ${label}` : label;
}

/** "2028. 09. 22. 만료" — 만료일이 없으면 빈 문자열 */
export function formatExpiresAt(iso: string | null): string {
  const date = formatDate(iso);
  return date ? `${date} 만료` : '';
}

function formatDate(iso: string | null): string {
  const date = iso ? new Date(iso) : null;
  if (!date || Number.isNaN(date.getTime())) return '';

  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}. ${month}. ${day}.`;
}
