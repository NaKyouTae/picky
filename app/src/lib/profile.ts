import { api } from '@/lib/api';
import type { Profile } from '@/lib/profile-format';

// 표시용 포맷터는 `lib/profile-format.ts` 에 있다 —
// 이 파일은 next/headers 를 쓰는 서버 전용이라 클라이언트 번들에 들어가면 안 된다.

/**
 * 내 정보 — 서버 컴포넌트 전용.
 * 로그인하지 않았거나 조회에 실패하면 null.
 */
export async function getMyProfile(): Promise<Profile | null> {
  return api.get<Profile>('/auth/profile', { cache: 'no-store' }).catch(() => null);
}
