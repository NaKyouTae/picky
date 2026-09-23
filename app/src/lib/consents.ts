import { api } from '@/lib/api';
import type { Consents } from '@/lib/consent-format';

// 표시용 포맷터는 `lib/consent-format.ts` 에 있다 —
// 이 파일은 next/headers 를 쓰는 서버 전용이라 클라이언트 번들에 들어가면 안 된다.

/**
 * 내 동의 상태 — 서버 컴포넌트 전용 (브라우저는 BFF `/api/auth/consents`).
 * 로그인하지 않았거나 조회에 실패하면 null — 화면은 동의 여부를 단정하지 않는다.
 */
export async function getMyConsents(): Promise<Consents | null> {
  return api.get<Consents>('/auth/consents', { cache: 'no-store' }).catch(() => null);
}
