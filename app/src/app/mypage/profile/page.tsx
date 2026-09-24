import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import { getMyProfile } from '@/lib/profile';
import { NOT_PROVIDED, formatBirthday, formatGender, formatPhone } from '@/lib/profile-format';

export const metadata = { title: '내 정보 · Picky' };

// 로그인한 사람의 값이므로 캐시하지 않는다.
export const dynamic = 'force-dynamic';

/**
 * 마이페이지 > 내 정보.
 *
 * SNS 로그인으로 **제공자에게 받아 보관 중인 항목**을 그대로 보여 준다 — 우리가 무엇을
 * 가지고 있는지 회원이 직접 확인할 수 있어야 하기 때문이다(개인정보 열람).
 *
 * 값이 없는 항목도 행을 숨기지 않고 '제공받지 않음' 으로 둔다. 숨기면 "그 항목은 아예
 * 수집하지 않는다" 로 읽히는데, 실제로는 동의를 받지 못했을 뿐이라 뜻이 달라진다.
 *
 * 여기서 고칠 수는 없다 — 값의 출처가 카카오·네이버 계정이라 그쪽에서 바꾸고 다시
 * 로그인해야 반영된다(빈 값은 `fillMissingProfile` 이 다음 로그인 때 채운다).
 */
export default async function ProfilePage() {
  const session = await getSession();
  if (!session) redirect('/');

  const profile = await getMyProfile();

  return (
    <div className="pb-page flex flex-1 flex-col">
      <PageHeader title="내 정보" />

      {profile ? (
        <>
          <dl className="mt-2 flex flex-col">
            <Row label="이름" value={profile.name} />
            <Row label="휴대전화번호" value={profile.phone ? formatPhone(profile.phone) : null} />
            <Row label="이메일" value={profile.email} />
            <Row label="성별" value={formatGender(profile.gender)} />
            {/* 생일(MM-DD)과 출생연도(YYYY)를 합쳐 한 줄로 보여 준다 — 저장도 Date 하나다 */}
            <Row label="생년월일" value={formatBirthday(profile.birthday)} />
            <Row label="연령대" value={profile.ageRange} />
          </dl>

          <p className="px-5 pt-6 text-xs leading-relaxed text-ink-sub">
            위 정보는 로그인에 사용한 카카오·네이버 계정에서 제공받은 것입니다. 내용을 바꾸려면 해당
            계정에서 수정한 뒤 다시 로그인해 주세요.
          </p>
        </>
      ) : (
        <p className="px-5 pt-6 text-sm text-ink-sub">
          내 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.
        </p>
      )}
    </div>
  );
}

/** 라벨 : 값 한 줄 — 값이 없으면 '제공받지 않음' 을 흐리게 보여 준다 */
function Row({ label, value }: { label: string; value: string | null }) {
  const provided = value != null && value !== NOT_PROVIDED;

  return (
    <div className="flex min-h-12 items-center gap-4 px-5 py-2">
      <dt className="w-24 shrink-0 text-sm text-ink-sub">{label}</dt>
      <dd
        className={
          provided
            ? 'min-w-0 flex-1 break-all text-sm font-medium'
            : 'min-w-0 flex-1 text-sm text-ink-sub/60'
        }
      >
        {provided ? value : NOT_PROVIDED}
      </dd>
    </div>
  );
}
