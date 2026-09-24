'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { SparkleMark } from '@/components/sparkle-mark';
import { compressImage } from '@/lib/compress-image';
import {
  INQUIRY_TYPES,
  INQUIRY_TYPE_LABELS,
  MAX_INQUIRY_CONTENT,
  MAX_INQUIRY_IMAGES,
  type InquiryType,
} from '@/lib/inquiries';
import { cn } from '@/lib/utils';

/** 고른 사진 한 장 — 미리보기는 objectURL 이라 버릴 때 해제해 줘야 한다 */
type Attachment = { file: File; url: string };

/**
 * 문의하기 폼 (디자인 4694:5381 · 작성 예시 4694:5559 · 완료 4694:5634).
 *
 * 세 화면이 아니라 한 화면이다 — 보내고 나면 같은 자리에서 완료 상태로 바뀐다.
 * 문의 내역을 볼 화면이 없으므로 보낸 뒤 폼으로 돌아갈 일도 없다.
 */
export function InquiryForm() {
  const [type, setType] = useState<InquiryType>('USAGE');
  const [content, setContent] = useState('');
  // 로그인 계정 이메일을 채워 두지 않는다 — 답변을 어디로 받을지는 사용자가 그때그때 정한다
  // (SNS 이메일은 선택 동의라 비어 있을 수도, 더 이상 쓰지 않는 주소일 수도 있다).
  const [email, setEmail] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const fileInput = useRef<HTMLInputElement>(null);

  // 화면을 떠날 때 남은 미리보기 주소를 해제한다.
  // attachments 를 의존성에 넣으면 사진을 고를 때마다 정리가 돌아 방금 만든 주소까지 풀린다 —
  // 최신 목록은 setter 의 콜백으로만 읽는다 (목록은 그대로 돌려주므로 상태는 바뀌지 않는다).
  useEffect(() => {
    return () => {
      setAttachments((current) => {
        current.forEach((item) => URL.revokeObjectURL(item.url));
        return current;
      });
    };
  }, []);

  const canSend = content.trim().length > 0 && isEmail(email) && !sending;

  /** 고른 파일을 줄여서 빈 칸에 채운다 (남은 칸 수를 넘기면 앞에서부터만 받는다) */
  async function handlePick(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files ?? []);
    // 같은 파일을 다시 고를 수 있도록 값을 비운다.
    event.target.value = '';
    if (picked.length === 0) return;

    setError(null);
    const room = MAX_INQUIRY_IMAGES - attachments.length;
    const added = await Promise.all(
      picked.slice(0, room).map(async (file) => {
        const compressed = await compressImage(file);
        return { file: compressed, url: URL.createObjectURL(compressed) };
      }),
    );
    setAttachments((current) => [...current, ...added].slice(0, MAX_INQUIRY_IMAGES));
  }

  function handleRemove(index: number) {
    setAttachments((current) => {
      URL.revokeObjectURL(current[index].url);
      return current.filter((_, i) => i !== index);
    });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSend) return;

    setSending(true);
    setError(null);

    const body = new FormData();
    body.append('type', type);
    body.append('content', content.trim());
    body.append('email', email.trim());
    attachments.forEach((item) => body.append('files', item.file));

    try {
      const res = await fetch('/api/inquiries', { method: 'POST', body, cache: 'no-store' });
      if (!res.ok) throw new Error();
      setDone(true);
    } catch {
      setError('문의를 보내지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <>
        <Hero
          title="문의가 접수되었어요."
          lines={['남겨주신 내용을 확인한 후', '입력하신 이메일로 답변드릴게요.']}
          // 완료 화면은 안내와 버튼 둘뿐이라, 남은 높이를 이 블록이 채워 버튼을 아래로 민다.
          className="flex-1"
        />
        <Link
          href="/"
          className="flex h-[52px] w-full shrink-0 items-center justify-center rounded-lg bg-point text-[16px] font-medium leading-none text-night active:bg-point/80"
        >
          메인으로 바로가기
        </Link>
      </>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <Hero
        title="궁금한 점이 있으신가요 ?"
        lines={['이용 중 불편하거나 궁금한 점을 남겨주세요.', '확인 후 입력하신 이메일로 답변드릴게요.']}
      />

      <Field label="문의 유형" id="inquiry-type">
        {/* 6칸을 같은 너비로 나눈다 — 칸 사이 간격이 없어 한 덩어리로 보인다 (디자인 4694:5424) */}
        <div role="group" aria-labelledby="inquiry-type-label" className="flex w-full">
          {INQUIRY_TYPES.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setType(value)}
              aria-pressed={type === value}
              className={cn(
                'h-7 min-w-0 flex-1 text-[12px] leading-none',
                type === value ? 'bg-point text-night' : 'bg-night-raised text-night-text',
              )}
            >
              {INQUIRY_TYPE_LABELS[value]}
            </button>
          ))}
        </div>
      </Field>

      <Field label="문의 내용" id="inquiry-content" control>
        <textarea
          id="inquiry-content"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          maxLength={MAX_INQUIRY_CONTENT}
          placeholder="문의할 내용을 입력해 주세요."
          // 디자인은 14px 이지만 입력칸은 16px 로 둔다 — iOS 가 그보다 작은 글씨에
          // 포커스하면 화면을 확대한다 (globals.css 의 base 규칙과 같은 이유).
          className="h-60 w-full resize-none bg-night-card px-5 py-2.5 text-[16px] leading-[1.6] text-night-text outline-none placeholder:text-night-sub"
        />
      </Field>

      <Field label="이메일" id="inquiry-email" control>
        <input
          id="inquiry-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          maxLength={255}
          placeholder="답변을 받을 이메일 주소를 입력해 주세요."
          className="h-11 w-full bg-night-card px-5 text-[16px] leading-[1.6] text-night-text outline-none placeholder:text-night-sub"
        />
      </Field>

      <Field label="첨부파일(선택)" id="inquiry-files" hint={`최대 ${MAX_INQUIRY_IMAGES}장`}>
        <div role="group" aria-labelledby="inquiry-files-label" className="flex w-full gap-2.5">
          {Array.from({ length: MAX_INQUIRY_IMAGES }, (_, index) => {
            const item = attachments[index];
            return item ? (
              <button
                key={item.url}
                type="button"
                onClick={() => handleRemove(index)}
                aria-label={`첨부한 ${index + 1}번째 사진 지우기`}
                className="relative aspect-square min-w-0 flex-1 overflow-hidden bg-night-card"
              >
                {/* objectURL 이라 next/image 로 최적화할 대상이 아니다 */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.url} alt="" className="absolute inset-0 size-full object-cover" />
                {/* 사진 위에 지우기 아이콘 — 어두운 사진에서도 보이도록 막을 한 겹 깐다 */}
                <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-night-text">
                  <DeleteIcon />
                </span>
              </button>
            ) : (
              <button
                key={index}
                type="button"
                // 첫 빈 칸에서만 선택창을 연다 — 어느 칸을 눌러도 앞에서부터 채워진다
                onClick={() => fileInput.current?.click()}
                aria-label="사진 첨부하기"
                className="flex aspect-square min-w-0 flex-1 items-center justify-center bg-night-card text-night-sub active:bg-night-raised"
              >
                <CameraIcon />
              </button>
            );
          })}
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          onChange={handlePick}
          className="hidden"
        />
      </Field>

      {error && <p className="text-[14px] leading-[1.6] text-point">{error}</p>}

      <button
        type="submit"
        disabled={!canSend}
        className="h-[52px] w-full shrink-0 rounded-lg bg-point text-[16px] font-medium leading-none text-night active:bg-point/80 disabled:opacity-40"
      >
        {sending ? '보내는 중…' : '보내기'}
      </button>
    </form>
  );
}

/** 별 마크 + 제목 + 두 줄 안내 — 작성 화면과 완료 화면이 같은 블록을 쓴다 */
function Hero({
  title,
  lines,
  className,
}: {
  title: string;
  lines: [string, string];
  className?: string;
}) {
  return (
    <div className={cn('flex w-full flex-col items-center gap-4 py-9 text-night-text', className)}>
      <SparkleMark />
      <p className="text-center text-[16px] leading-[1.6]">{title}</p>
      <p className="text-center text-[14px] leading-[1.6] text-night-sub">
        {lines[0]}
        <br />
        {lines[1]}
      </p>
    </div>
  );
}

/**
 * 라벨(+ 오른쪽 보조 문구) 한 줄 + 입력칸 한 덩어리.
 *
 * 칸이 진짜 입력 요소 하나면(`control`) <label for> 로 묶고, 버튼 묶음(유형 칩·사진 칸)이면
 * <label> 을 쓰지 않는다 — 라벨을 누르면 그 안의 첫 버튼이 눌리기 때문이다.
 * 그쪽은 묶음에 `role="group"` + `aria-labelledby` 로 같은 이름을 달아 준다.
 */
function Field({
  label,
  id,
  hint,
  control = false,
  children,
}: {
  label: string;
  id: string;
  hint?: string;
  control?: boolean;
  children: React.ReactNode;
}) {
  const Label = control ? 'label' : 'span';

  return (
    <div className="flex w-full flex-col gap-2.5">
      <span className="flex items-start justify-between text-[14px] leading-none">
        <Label
          id={`${id}-label`}
          {...(control ? { htmlFor: id } : {})}
          className="text-night-text"
        >
          {label}
        </Label>
        {hint && <span className="text-night-sub">{hint}</span>}
      </span>
      {children}
    </div>
  );
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-6" aria-hidden>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M9 2 7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-6" aria-hidden>
      <path d="M6 21h12V7H6v14zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
    </svg>
  );
}

/**
 * 보내기 버튼을 열어 줄 만큼의 이메일 형식 확인.
 * 진짜 검증은 서버(`IsEmail`)가 하고, 여기서는 빈 칸·오타로 버튼을 눌러 실패하는 것만 막는다.
 */
function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
