import { PolicyPage, PolicySection } from '@/components/policy-page';

export const metadata = { title: '마케팅 정보 수신 동의 · Picky' };

export default function MarketingPage() {
  return (
    <PolicyPage title="마케팅 정보 수신 동의" effectiveDate="2026년 9월 21일">
      <PolicySection title="1. 수집·이용 목적">
        <p>
          회사는 서비스 이용과 관련된 이벤트, 혜택, 신규 기능 안내 등 마케팅 정보를 이메일 등의
          방법으로 제공할 수 있습니다.
        </p>
      </PolicySection>

      <PolicySection title="2. 동의의 유효기간">
        <p>
          마케팅 정보 수신 동의의 유효기간은 동의일로부터{' '}
          <strong className="font-medium text-night-text">2년</strong>이며, 유효기간이 만료되면 동의
          효력이 자동으로 종료되어 마케팅 정보 발송이 중단됩니다. 만료 이후 계속 수신을 원하시는
          경우 마이페이지에서 다시 동의해 주시기 바랍니다. (개인정보 보호법 시행령 제48조의2)
        </p>
      </PolicySection>

      <PolicySection title="3. 동의 철회">
        <p>
          회원은 언제든지 마이페이지에서 마케팅 정보 수신 동의를 철회할 수 있으며, 동의를 거부하거나
          철회하시더라도 서비스 이용에는 제한이 없습니다.
        </p>
      </PolicySection>
    </PolicyPage>
  );
}
