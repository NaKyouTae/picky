import { ConsentType } from '../generated/prisma/enums';

/**
 * SNS 간편가입 동의화면에서 받아 온 약관 동의 한 건.
 * 제공자마다 응답 모양이 달라 이 형태로 맞춰 AuthService 에 넘긴다.
 */
export interface ProviderConsent {
  type: ConsentType;
  /** 제공자가 준 약관 태그 원문 (예: service_20260921) — 어떤 판본인지 증빙용 */
  tag: string;
  agreed: boolean;
  /** 제공자가 알려준 동의 시각 — 미동의거나 주지 않으면 null */
  agreedAt: Date | null;
}

/**
 * 약관 태그 접두사 → 동의 항목.
 *
 * 카카오 콘솔 [간편가입 > 서비스 약관]에 등록한 태그와 짝이 맞아야 한다.
 * 약관을 개정하면 기존 태그를 고치지 않고 `service_20270101` 처럼 **새 태그**로 등록해야 하므로,
 * 날짜 부분을 뺀 접두사로 맞춘다 (개정 때마다 이 표를 고치지 않아도 된다).
 *
 * `third_party_` 를 `privacy_` 보다 먼저 볼 필요는 없다 — 접두사가 서로 겹치지 않는다.
 */
const CONSENT_TAG_PREFIXES: ReadonlyArray<[prefix: string, type: ConsentType]> = [
  ['service_', ConsentType.TERMS],
  ['privacy_', ConsentType.PRIVACY],
  ['third_party_', ConsentType.THIRD_PARTY],
  ['marketing_', ConsentType.MARKETING],
];

/** 우리가 쓰는 동의 항목이 아니면 null — 모르는 태그는 그냥 무시한다. */
export function mapConsentTag(tag: string): ConsentType | null {
  const normalized = tag.trim().toLowerCase();
  for (const [prefix, type] of CONSENT_TAG_PREFIXES) {
    if (normalized.startsWith(prefix)) return type;
  }
  return null;
}

/**
 * 같은 항목의 태그가 여러 개 오면(과거 판본 + 최신 판본) 가장 최근 동의만 남긴다.
 * 동의한 건이 있으면 미동의 건보다 우선한다 — 옛 판본을 거부했어도 최신 판본에 동의했으면 동의다.
 */
export function dedupeConsents(consents: ProviderConsent[]): ProviderConsent[] {
  const latest = new Map<ConsentType, ProviderConsent>();

  for (const consent of consents) {
    const current = latest.get(consent.type);
    if (!current || isNewer(consent, current)) latest.set(consent.type, consent);
  }

  return [...latest.values()];
}

function isNewer(candidate: ProviderConsent, current: ProviderConsent): boolean {
  if (candidate.agreed !== current.agreed) return candidate.agreed;
  // 동의 시각을 주지 않은 건은 시각이 있는 건을 이기지 못한다.
  if (!candidate.agreedAt) return false;
  if (!current.agreedAt) return true;
  return candidate.agreedAt > current.agreedAt;
}
