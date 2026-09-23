import { ConsentBar } from '@/components/consent-bar';
import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import { getMyConsents } from '@/lib/consents';

export const metadata = { title: '마케팅 정보 수신 동의 · Picky' };

// 로그인 여부에 따라 하단 동의 바가 달라진다.
export const dynamic = 'force-dynamic';

export default async function MarketingPage() {
  // 비로그인 상태에서도 내용은 읽을 수 있어야 하므로 막지 않는다.
  const session = await getSession();
  // 동의 바에 쓸 값 — 비로그인이면 바 자체가 없으므로 조회하지 않는다.
  const consents = session ? await getMyConsents() : null;

  return (
    <div className={session ? 'pb-cta flex flex-1 flex-col' : 'pb-page flex flex-1 flex-col'}>
      <PageHeader title="마케팅 정보 수신 동의" />

      <article className="space-y-6 px-5 pb-6 pt-4 text-sm leading-relaxed text-ink-sub">
        <p className="text-right text-xs">시행일자: 2026년 9월 21일</p>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-ink">1. 수집·이용 목적</h2>
          <p>
            회사는 서비스 이용과 관련된 이벤트, 혜택, 신규 기능 안내 등 마케팅 정보를 이메일 등의
            방법으로 제공할 수 있습니다.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-ink">2. 동의의 유효기간</h2>
          <p>
            마케팅 정보 수신 동의의 유효기간은 동의일로부터 <strong>2년</strong>이며, 유효기간이
            만료되면 동의 효력이 자동으로 종료되어 마케팅 정보 발송이 중단됩니다. 만료 이후 계속
            수신을 원하시는 경우 마이페이지 또는 본 페이지에서 다시 동의해 주시기 바랍니다.
            (개인정보 보호법 시행령 제48조의2)
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-ink">3. 동의 철회</h2>
          <p>
            회원은 언제든지 마이페이지에서 마케팅 정보 수신 동의를 철회할 수 있으며, 동의를
            거부하거나 철회하시더라도 서비스 이용에는 제한이 없습니다.
          </p>
        </section>
      </article>

      {session && <ConsentBar consentKey="marketing" initialConsents={consents} />}
    </div>
  );
}
