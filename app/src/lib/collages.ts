'use client';

/**
 * 완성한 콜라주 보관함.
 *
 * **보관은 누구나, 다시 받는 것은 유료 회원만.** 콜라주를 완성하면 등급과 무관하게 올라가고,
 * '완료한 챌린지' 에서 다시 받을 때만 서버가 회원권을 확인한다 — 없거나 기간이 끝났으면 403,
 * 다시 구매하면 열린다 (파일은 지우지 않으므로 예전 콜라주가 그대로 돌아온다).
 *
 * 브라우저에서 부르므로 BFF(`/api/*`)를 거친다.
 */

/** 완성본 보관 (등급 무관). 그룹당 한 장이라 다시 올리면 덮어쓴다 */
export async function keepCollage(groupId: string, blob: Blob): Promise<void> {
  const body = new FormData();
  body.append('file', new File([blob], `${groupId}.png`, { type: 'image/png' }));

  const res = await fetch(`/api/collages/${groupId}`, { method: 'POST', body });
  if (!res.ok) throw new Error(`콜라주 보관 실패 (${res.status})`);
}

export type CollageDownload =
  | { ok: true; url: string }
  /** 회원권이 없거나 기간이 끝났다 — 다시 구매해야 받을 수 있다 */
  | { ok: false; reason: 'membership' }
  /** 보관된 콜라주가 없다 (완성하기 전에 화면을 떠났거나, 보관에 실패했다) */
  | { ok: false; reason: 'missing' }
  | { ok: false; reason: 'failed' };

/** 보관한 콜라주의 내려받기 주소 (짧은 signed URL) */
export async function getCollageDownload(groupId: string): Promise<CollageDownload> {
  let res: Response;
  try {
    res = await fetch(`/api/collages/${groupId}/download`, { cache: 'no-store' });
  } catch {
    return { ok: false, reason: 'failed' };
  }

  // 회원권 만료와 '보관본 없음' 을 구분해야 안내 문구가 달라진다.
  if (res.status === 403) return { ok: false, reason: 'membership' };
  if (res.status === 404) return { ok: false, reason: 'missing' };
  if (!res.ok) return { ok: false, reason: 'failed' };

  const { url } = (await res.json()) as { url?: string };
  return url ? { ok: true, url } : { ok: false, reason: 'failed' };
}
