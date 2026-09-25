import { PolicyPage, PolicySection } from '@/components/policy-page';

export const metadata = { title: '개인정보 제3자 제공 동의 · Picky' };

export default function ThirdPartyPage() {
  return (
    <PolicyPage title="개인정보 제3자 제공 동의" effectiveDate="2026년 10월 2일">
      <PolicySection>
        <p>회사는 원활한 서비스 제공을 위해 아래와 같이 개인정보를 제3자에게 제공할 수 있습니다.</p>
      </PolicySection>

      <PolicySection title="소셜 로그인 제공자">
        <ul className="list-disc space-y-1 pl-5">
          <li>제공받는 자: 주식회사 카카오, 네이버 주식회사, Apple Inc.</li>
          <li>제공 목적: 간편 로그인 인증 및 회원 탈퇴 시 계정 연결 해제</li>
          <li>제공 항목: 회원이 로그인에 사용한 제공자의 소셜 로그인 식별자(회원번호)</li>
          <li>보유 및 이용 기간: 회원 탈퇴 시 연결 해제 후 지체 없이 파기</li>
        </ul>
        <p className="text-[12px] leading-5">
          ※ Apple Inc.는 미국에 소재하며, 로그인 인증을 위해 위 항목이 국외로 이전될 수 있습니다.
        </p>
      </PolicySection>

      <PolicySection>
        <p>
          위에 적힌 경우를 제외하고, 회사는 회원의 개인정보를 제3자에게 제공하지 않습니다. 서비스
          운영을 위해 외부 업체에 처리를 맡기는 경우(데이터베이스·호스팅 등)는 제3자 제공이 아닌
          &apos;처리 위탁&apos;에 해당하며, 그 내역은 개인정보처리방침 5항에서 확인할 수 있습니다.
        </p>
        <p>
          회원은 개인정보 제3자 제공에 대한 동의를 거부할 권리가 있으며, 동의하지 않을 경우 소셜
          로그인 등 일부 서비스 이용에 제한이 있을 수 있습니다. 동의 여부는 마이페이지에서 언제든지
          바꿀 수 있습니다.
        </p>
      </PolicySection>
    </PolicyPage>
  );
}
