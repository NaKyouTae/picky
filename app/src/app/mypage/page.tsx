import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LogoutButton } from '@/components/logout-button';
import { ConsentMenuRow } from '@/components/consent-menu-row';
import { PageHeader } from '@/components/page-header';
import {
  MarketingIcon,
  PrivacyIcon,
  RefundIcon,
  TermsIcon,
  ThirdPartyIcon,
} from '@/components/policy-icons';
import { getSession } from '@/lib/auth';

// 세션에 따라 내용이 달라지므로 캐시하지 않는다.
export const dynamic = 'force-dynamic';

export default async function MyPage() {
  const session = await getSession();
  // 로그인하지 않았으면 볼 것이 없다 (홈에서 로그인 모달을 띄운다).
  if (!session) redirect('/');

  return (
    <div className="pb-page flex flex-1 flex-col">
      <PageHeader title="마이페이지" variant="close" href="/" />

      {/* 프로필 */}
      <section className="flex items-center gap-4 px-5 pb-6 pt-3">
        <span className="flex size-15 shrink-0 items-center justify-center rounded-full bg-canvas text-ink-sub">
          <ProfileIcon />
        </span>
        <div className="min-w-0">
          <p className="truncate text-base font-semibold">{session.name} 님</p>
          <p className="mt-1 truncate text-xs text-ink-sub">{session.email}</p>
        </div>
      </section>

      {/* 약관/정책 */}
      <section>
        <h2 className="px-5 text-xs font-medium text-ink-sub">약관/정책</h2>
        <div className="mt-3 flex flex-col">
          <MenuLink href="/mypage/terms" label="이용약관" icon={<TermsIcon />} />
          <MenuLink href="/mypage/privacy" label="개인정보처리방침" icon={<PrivacyIcon />} />
          <MenuLink href="/mypage/refund" label="환불정책" icon={<RefundIcon />} />
          <ConsentMenuRow
            consentKey="thirdParty"
            label="개인정보 제3자 제공 동의"
            href="/mypage/third-party"
            icon={<ThirdPartyIcon />}
          />
          <ConsentMenuRow
            consentKey="marketing"
            label="마케팅 정보 수신 동의"
            href="/mypage/marketing"
            icon={<MarketingIcon />}
          />
        </div>
      </section>

      <div className="mt-12 flex justify-center">
        <LogoutButton />
      </div>

      {/* 사업자 정보 */}
      <section className="mt-auto px-5 pt-12">
        <ul className="space-y-1 text-[11px] leading-relaxed text-ink-sub">
          <li>사업자명 : 스펙트럼</li>
          <li>대표자 : 나규태</li>
          <li>사업자등록번호 : 244-20-02381</li>
          <li>고객센터 : spectrum.mesh@gmail.com</li>
        </ul>
      </section>
    </div>
  );
}

function MenuLink({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <Link href={href} className="flex min-h-12 items-center gap-2.5 px-5 active:bg-canvas">
      <span className="flex size-4 shrink-0 items-center justify-center text-ink">{icon}</span>
      <span className="flex-1 text-base font-medium">{label}</span>
      <ChevronIcon />
    </Link>
  );
}

function ProfileIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-8"
      aria-hidden
    >
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.8 20.2a7.2 7.2 0 0 1 14.4 0" />
    </svg>
  );
}




function ChevronIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4 shrink-0 text-ink-sub"
      aria-hidden
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}
