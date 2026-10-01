'use client';

import { useState } from 'react';
import {
  CHALLENGE_STATUS_LABELS,
  STATUSES,
  type AdminChallenge,
  type AdminChallengeCategory,
  type ChallengeStatus,
} from '@/lib/challenges';

/** 챌린지가 갖는 값은 이 셋뿐이다 — 설명·소요 시간·이모지는 두지 않는다 */
type FormValues = {
  categoryId: string;
  status: ChallengeStatus;
  title: string;
};

function toFormValues(
  challenge: AdminChallenge | undefined,
  fallbackCategoryId: string,
): FormValues {
  return {
    categoryId: challenge?.categoryId ?? fallbackCategoryId,
    status: challenge?.status ?? 'PUBLISHED',
    title: challenge?.title ?? '',
  };
}

const LABEL = 'block text-sm font-medium';
const FIELD =
  'mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand-500';

/**
 * 챌린지 등록/수정 폼 — 목록 화면의 모달 안에서만 쓴다.
 * challenge 가 있으면 수정 모드(PATCH), 없으면 등록 모드(POST). 삭제는 목록에서 한다.
 *
 * 저장/취소 후 모달을 닫고 목록을 갱신하는 일은 호출하는 쪽(onDone/onCancel)이 한다 —
 * 등록과 수정은 돌아갈 페이지가 다르므로 무엇을 했는지 함께 알려 준다.
 */
export function ChallengeForm({
  challenge,
  categories,
  onDone,
  onCancel,
}: {
  challenge?: AdminChallenge;
  /** 어드민에 등록된 카테고리 — 선택 목록을 여기서 그린다 */
  categories: AdminChallengeCategory[];
  onDone: (result: 'created' | 'updated') => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<FormValues>(() =>
    toFormValues(challenge, categories[0]?.id ?? ''),
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editing = Boolean(challenge);

  function set<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const body = {
      categoryId: values.categoryId,
      status: values.status,
      title: values.title.trim(),
    };

    try {
      const res = await fetch(
        editing ? `/api/admin/challenges/${challenge!.id}` : '/api/admin/challenges',
        {
          method: editing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) throw new Error(await readError(res));

      onDone(editing ? 'updated' : 'created');
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장에 실패했습니다.');
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="category" className={LABEL}>
            카테고리
          </label>
          <select
            id="category"
            value={values.categoryId}
            onChange={(event) => set('categoryId', event.target.value)}
            className={FIELD}
          >
            {categories.length === 0 && <option value="">등록된 카테고리가 없습니다</option>}
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.emoji ? `${category.emoji} ` : ''}
                {category.name}
                {category.status !== 'PUBLISHED' ? ' (비공개)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="status" className={LABEL}>
            상태
          </label>
          <select
            id="status"
            value={values.status}
            onChange={(event) => set('status', event.target.value as ChallengeStatus)}
            className={FIELD}
          >
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {CHALLENGE_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-ink-sub">공개 상태만 앱에서 랜덤으로 뽑힙니다.</p>
        </div>
      </div>

      <div>
        <label htmlFor="title" className={LABEL}>
          제목
        </label>
        <input
          id="title"
          value={values.title}
          onChange={(event) => set('title', event.target.value)}
          placeholder="서로 좋아하는 영화 바꿔 시청하기"
          required
          minLength={2}
          maxLength={120}
          className={FIELD}
        />
      </div>

      {error && <p className="text-sm text-brand-600">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="h-11 rounded-lg bg-brand-500 px-5 sm:h-10 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
        >
          {pending ? '저장 중' : editing ? '수정' : '등록'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="h-11 rounded-lg border border-line bg-white px-5 sm:h-10 text-sm text-ink-sub hover:bg-gray-100 disabled:opacity-60"
        >
          취소
        </button>
      </div>
    </form>
  );
}

/** NestJS 예외 필터가 내려주는 message 를 꺼내고, 형식이 다르면 상태 코드로 대체한다 */
async function readError(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
  const message = body?.message;
  if (Array.isArray(message)) return message.join('\n');
  return message ?? `요청이 실패했습니다 (${res.status})`;
}
