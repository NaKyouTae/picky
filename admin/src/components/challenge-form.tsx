'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  CHALLENGE_STATUS_LABELS,
  STATUSES,
  type AdminChallenge,
  type AdminChallengeCategory,
  type ChallengeStatus,
} from '@/lib/challenges';

type FormValues = {
  categoryId: string;
  status: ChallengeStatus;
  title: string;
  description: string;
  duration: string;
  emoji: string;
};

function toFormValues(
  challenge: AdminChallenge | undefined,
  fallbackCategoryId: string,
): FormValues {
  return {
    categoryId: challenge?.categoryId ?? fallbackCategoryId,
    status: challenge?.status ?? 'PUBLISHED',
    title: challenge?.title ?? '',
    description: challenge?.description ?? '',
    duration: challenge?.duration ?? '',
    emoji: challenge?.emoji ?? '',
  };
}

const LABEL = 'block text-sm font-medium';
const FIELD =
  'mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand-500';

/**
 * 챌린지 등록/수정 폼.
 * challenge 가 있으면 수정 모드(PATCH + 삭제 버튼), 없으면 등록 모드(POST).
 *
 * 저장/취소 후 동작은 호출하는 쪽이 정한다 — 모달에서는 닫고 목록을 갱신하고,
 * 콜백이 없으면(페이지로 쓸 때) 목록 화면으로 이동한다.
 */
export function ChallengeForm({
  challenge,
  categories,
  framed = true,
  onDone,
  onCancel,
}: {
  challenge?: AdminChallenge;
  /** 어드민에 등록된 카테고리 — 선택 목록을 여기서 그린다 */
  categories: AdminChallengeCategory[];
  /** 카드 테두리 — 모달 안에서는 이미 테두리가 있으므로 false */
  framed?: boolean;
  onDone?: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>(() =>
    toFormValues(challenge, categories[0]?.id ?? ''),
  );
  const [pending, setPending] = useState<'save' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const editing = Boolean(challenge);

  function set<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function done() {
    if (onDone) {
      onDone();
      return;
    }
    router.push('/challenges');
    router.refresh();
  }

  function cancel() {
    if (onCancel) {
      onCancel();
      return;
    }
    router.push('/challenges');
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending('save');
    setError(null);

    // 빈 문자열은 보내지 않는다 — 서버 DTO 에서 선택 필드는 생략이 곧 "없음" 이다.
    const body = {
      categoryId: values.categoryId,
      status: values.status,
      title: values.title.trim(),
      description: values.description.trim() || undefined,
      duration: values.duration.trim() || undefined,
      emoji: values.emoji.trim() || undefined,
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

      done();
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장에 실패했습니다.');
      setPending(null);
    }
  }

  async function handleDelete() {
    if (!challenge) return;
    if (!window.confirm('이 챌린지를 삭제할까요? 되돌릴 수 없습니다.')) return;

    setPending('delete');
    setError(null);
    try {
      const res = await fetch(`/api/admin/challenges/${challenge.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await readError(res));

      done();
    } catch (e) {
      setError(e instanceof Error ? e.message : '삭제에 실패했습니다.');
      setPending(null);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={
        framed ? 'max-w-2xl space-y-5 rounded-xl border border-line bg-white p-6' : 'space-y-5'
      }
    >
      <div className="grid grid-cols-2 gap-4">
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

      <div className="grid grid-cols-[5rem_1fr] gap-4">
        <div>
          <label htmlFor="emoji" className={LABEL}>
            이모지
          </label>
          <input
            id="emoji"
            value={values.emoji}
            onChange={(event) => set('emoji', event.target.value)}
            placeholder="🎬"
            maxLength={8}
            className={FIELD}
          />
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
      </div>

      <div>
        <label htmlFor="duration" className={LABEL}>
          소요 시간
        </label>
        <input
          id="duration"
          value={values.duration}
          onChange={(event) => set('duration', event.target.value)}
          placeholder="2시간"
          maxLength={40}
          className={FIELD}
        />
      </div>

      <div>
        <label htmlFor="description" className={LABEL}>
          설명
        </label>
        <textarea
          id="description"
          value={values.description}
          onChange={(event) => set('description', event.target.value)}
          placeholder="어떻게 진행하는 챌린지인지 알려주세요."
          rows={5}
          maxLength={2000}
          className={FIELD}
        />
      </div>

      {error && <p className="text-sm text-brand-600">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending !== null}
          className="h-10 rounded-lg bg-brand-500 px-5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
        >
          {pending === 'save' ? '저장 중…' : editing ? '수정' : '등록'}
        </button>
        <button
          type="button"
          onClick={cancel}
          disabled={pending !== null}
          className="h-10 rounded-lg border border-line bg-white px-5 text-sm text-ink-sub hover:bg-gray-100 disabled:opacity-60"
        >
          취소
        </button>
        {editing && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={pending !== null}
            className="ml-auto h-10 rounded-lg border border-line bg-white px-5 text-sm text-brand-600 hover:bg-brand-500/5 disabled:opacity-60"
          >
            {pending === 'delete' ? '삭제 중…' : '삭제'}
          </button>
        )}
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
