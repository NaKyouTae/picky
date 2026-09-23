import { PolicyPage, PolicySection } from '@/components/policy-page';
import { BUSINESS } from '@/lib/business';

export const metadata = { title: '환불정책 · Picky' };

const SUPPORT_EMAIL = BUSINESS.email;

/** 문의 메일 본문을 미리 채워 두면 필요한 정보를 빠짐없이 받을 수 있다. */
const MAILTO = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
  '[Picky] 환불 요청',
)}&body=${encodeURIComponent(
  '아래 내용을 작성해 주세요.\n\n- 결제 일시: \n- 결제 수단: \n- 결제 상품명: \n- 환불 사유: \n- 연락 가능한 이메일: \n',
)}`;

export default function RefundPage() {
  return (
    <PolicyPage
      title="환불정책"
      effectiveDate="2026년 9월 23일"
      addendum="부칙: 본 환불정책은 2026년 9월 21일부터 시행됩니다."
    >
      <PolicySection title="1. 기본 원칙">
        <p>
          스펙트럼(이하 &quot;회사&quot;)이 운영하는 &quot;Picky&quot; 서비스는 현재 모든 기능을
          무료로 제공하고 있으며, 별도의 결제가 발생하지 않습니다. 회사가 유료 서비스를 도입하는
          경우 「전자상거래 등에서의 소비자보호에 관한 법률」 및 관련 법령에서 정한 회원의 권리를
          보장하며, 본 환불정책에 따라 결제 취소 및 환불을 처리합니다.
        </p>
      </PolicySection>

      <PolicySection title="2. 청약철회 (단순 변심에 의한 환불)">
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            회원은 유료 서비스 결제일로부터{' '}
            <strong className="font-medium text-night-text">7일 이내</strong>에 청약철회를 신청할 수
            있습니다.
          </li>
          <li>
            <p>다만, 다음의 경우에는 청약철회가 제한될 수 있습니다.</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>결제 후 유료 서비스를 이미 사용했거나 일부라도 이용한 경우</li>
              <li>일회성으로 제공되는 디지털 콘텐츠가 즉시 제공 완료된 경우</li>
              <li>기타 관련 법령에서 청약철회가 제한되는 경우</li>
            </ul>
          </li>
          <li>
            청약철회 제한 사유에 해당하는 상품의 경우, 결제 화면 및 상품 안내에 그 사실을 명확히
            표시하고 회원의 동의를 받습니다.
          </li>
        </ol>
      </PolicySection>

      <PolicySection title="3. 회사의 귀책사유로 인한 환불">
        <p>
          서비스 결함, 장기간 서비스 장애 등 회사의 귀책사유로 정상적인 서비스 이용이 불가능한 경우,
          회원은 이용 기간과 관계없이 전액 환불을 요청할 수 있습니다.
        </p>
      </PolicySection>

      <PolicySection title="4. 정기결제(구독) 환불">
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            정기결제 상품은 회원이 직접 다음 결제일 전까지 해지할 수 있으며, 해지 시 다음 결제부터
            청구되지 않습니다.
          </li>
          <li>이미 결제된 이용 기간에 대한 환불은 사용 내역 및 잔여 일수에 따라 산정됩니다.</li>
          <li>
            해당 결제 주기 내에 유료 기능을 이용하지 않은 경우, 결제일로부터 7일 이내에 한해 전액
            환불이 가능합니다.
          </li>
        </ol>
      </PolicySection>

      {/* iOS 앱은 App Store 인앱결제로 판다 — 대금을 Apple 이 수령하므로 회사가 취소할 수
          없다. 이 조항이 없으면 앱에서 결제한 회원이 고객센터로 헛걸음하게 된다. */}
      <PolicySection title="5. 앱 내 결제(In-App Purchase)">
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            iOS 앱에서 구매한 회원권은 Apple의 App Store를 통해 결제되며, 결제 대금은 Apple이
            수령합니다.
          </li>
          <li>
            이 경우 환불은{' '}
            <strong className="font-medium text-night-text">
              Apple의 환불 정책과 절차에 따라 Apple이 처리
            </strong>
            하며, 회사가 직접 결제를 취소하거나 환불할 수 없습니다.
          </li>
          <li>
            환불 요청은{' '}
            <a
              href="https://reportaproblem.apple.com"
              target="_blank"
              rel="noreferrer"
              className="text-main underline underline-offset-2"
            >
              reportaproblem.apple.com
            </a>{' '}
            에서 Apple 계정으로 로그인해 접수할 수 있습니다.
          </li>
          <li>
            어느 경로로 결제했는지는 마이페이지 &gt; 결제 내역의 &lsquo;결제처&rsquo;에서 확인할 수
            있습니다.
          </li>
          <li>
            Apple의 환불 심사 결과와 무관하게, 회사의 귀책사유로 서비스를 이용하지 못한 경우에는
            제3항에 따른 보상을 요청할 수 있습니다.
          </li>
        </ol>
      </PolicySection>

      <PolicySection title="6. 환불 신청 방법">
        <p>아래는 웹에서 결제한 회원권에 해당합니다. 앱 내 결제는 제5항을 따릅니다.</p>
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            환불은 고객센터 이메일(
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-main underline underline-offset-2">
              {SUPPORT_EMAIL}
            </a>
            )로 접수해 주세요.
          </li>
          <li>
            <p>원활한 처리를 위해 아래 내용을 함께 기재해 주세요.</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>결제 일시 및 결제 수단</li>
              <li>결제 상품명</li>
              <li>환불 사유</li>
              <li>연락 가능한 이메일</li>
            </ul>
          </li>
          <li>회사는 신청 접수 후 영업일 기준 3일 이내에 처리 결과를 이메일로 회신합니다.</li>
        </ol>

        {/* 다른 다크 화면의 주요 버튼과 같은 모양 (point 배경 + night 글자) */}
        <a
          href={MAILTO}
          className="mt-1.5 flex h-[52px] items-center justify-center gap-2.5 rounded-lg bg-point text-[16px] font-medium text-night active:bg-main"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-[18px]"
            aria-hidden
          >
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <path d="m22 6-10 7L2 6" />
          </svg>
          이메일로 환불 요청하기
        </a>
      </PolicySection>

      <PolicySection title="7. 환불 처리 기간">
        <ol className="list-decimal space-y-2 pl-5">
          <li>환불은 결제 시 사용한 결제 수단으로 동일하게 처리되는 것을 원칙으로 합니다.</li>
          <li>
            결제 수단별 환불 처리에는 영업일 기준 3~7일이 소요될 수 있으며, 카드사·은행·간편결제사의
            정책에 따라 추가 시간이 소요될 수 있습니다.
          </li>
        </ol>
      </PolicySection>

      <PolicySection title="8. 문의">
        <p>
          환불 및 결제 관련 문의는 고객센터 이메일(
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-main underline underline-offset-2">
            {SUPPORT_EMAIL}
          </a>
          )로 접수해 주세요.
        </p>
        {/* 사업자 정보 — 개인정보처리방침과 같은 줄글 형태. 값은 lib/business.ts 에서만 온다 */}
        <address className="not-italic">
          <span className="block">사업자명 : {BUSINESS.name}</span>
          <span className="block">대표자 : {BUSINESS.ceo}</span>
          <span className="block">사업자등록번호 : {BUSINESS.registrationNumber}</span>
          <span className="block">통신판매업신고번호 : {BUSINESS.mailOrderNumber}</span>
          <span className="block">영업소 소재지 : {BUSINESS.address}</span>
          <span className="block">고객센터 : {SUPPORT_EMAIL}</span>
        </address>
      </PolicySection>
    </PolicyPage>
  );
}
