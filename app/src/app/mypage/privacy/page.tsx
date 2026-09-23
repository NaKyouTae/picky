import { PolicyPage, PolicySection } from '@/components/policy-page';
import { BUSINESS } from '@/lib/business';

export const metadata = { title: '개인정보처리방침 · Picky' };

/** 개인정보 처리 위탁 현황 — 바뀌면 이 표와 시행일자를 함께 고친다. */
const PROCESSORS = [
  { name: 'Supabase', task: '회원 정보 데이터베이스 운영' },
  { name: '카카오', task: '소셜 로그인 인증' },
  { name: 'Vercel, 클라우드타입', task: '서비스 호스팅' },
];

export default function PrivacyPage() {
  return (
    <PolicyPage
      title="개인정보처리방침"
      effectiveDate="2026년 9월 21일"
      addendum="부칙: 본 개인정보처리방침은 2026년 9월 21일부터 시행됩니다."
    >
      <PolicySection>
        <p>
          스펙트럼(이하 &quot;회사&quot;)은 「개인정보 보호법」 등 관련 법령을 준수하며, 회원의
          개인정보를 보호하기 위해 최선을 다하고 있습니다. 본 개인정보처리방침은 회사가 제공하는
          서비스 &quot;Picky&quot;(이하 &quot;서비스&quot;)에서 회원의 개인정보를 어떻게
          수집·이용·보관·파기하는지를 안내합니다.
        </p>
      </PolicySection>

      <PolicySection title="1. 수집하는 개인정보 항목">
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            <p>회원가입 시 (소셜 로그인)</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>필수: 이메일 주소, 이름(닉네임), 소셜 로그인 식별자(카카오 회원번호)</li>
              <li>
                선택: 성별, 연령대, 생년월일 — 카카오 로그인 시 이용자가 제공에 동의한 항목만
                전달됩니다
              </li>
            </ul>
          </li>
          <li>
            <p>서비스 이용 시</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>고른 카테고리, 뽑힌 챌린지, 진행·완료·종료 시각 등 챌린지 기록</li>
            </ul>
          </li>
          <li>
            <p>자동 수집 항목</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>로그인 유지를 위한 쿠키</li>
              <li>호스팅 서비스가 자동으로 남기는 접속 로그 및 IP 주소</li>
            </ul>
            <p className="mt-1 text-[12px] leading-5">
              ※ 회사는 별도의 분석 도구를 통해 이용 행태나 기기 정보를 수집하지 않습니다.
            </p>
          </li>
        </ol>
      </PolicySection>

      <PolicySection title="2. 개인정보의 수집·이용 목적">
        <ol className="list-decimal space-y-1 pl-5">
          <li>회원 식별, 회원가입 의사 확인 및 계정 관리</li>
          <li>챌린지 추천 및 진행 기록 제공</li>
          <li>고객 문의 응대, 공지사항 전달</li>
          <li>서비스 품질 개선, 부정 이용 방지, 통계 분석</li>
          <li>마케팅 정보 수신에 동의한 회원에 한하여 신규 기능·이벤트 안내</li>
        </ol>
      </PolicySection>

      <PolicySection title="3. 개인정보의 보유 및 이용 기간">
        <ol className="list-decimal space-y-1 pl-5">
          <li>회원 탈퇴 시 회사가 수집한 개인정보는 지체 없이 파기하는 것을 원칙으로 합니다.</li>
          <li>
            접속 로그는 호스팅 서비스의 보관 정책에 따라 일정 기간 보관된 뒤 자동으로 삭제됩니다.
          </li>
          <li>
            회사가 유료 서비스를 도입하는 경우, 결제·청약철회에 관한 기록은 관련 법령이 정한
            기간(전자상거래법상 5년, 소비자 불만·분쟁 처리 기록 3년) 동안 보관합니다.
          </li>
          <li>
            마케팅 정보 수신 동의는 동의일로부터 2년간 유효하며, 만료 시 재동의를 받습니다 (개인정보
            보호법 시행령 제48조의2).
          </li>
        </ol>
      </PolicySection>

      <PolicySection title="4. 개인정보의 제3자 제공">
        <p>
          회사는 회원이 동의한 범위 또는 법령이 정한 경우에 한하여 개인정보를 제3자에게 제공합니다.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>제공받는 자: 카카오 (소셜 로그인 제공자)</li>
          <li>제공 목적: 간편 로그인 인증 및 회원 식별</li>
          <li>제공 항목: 소셜 로그인 식별자, 이메일 주소, 이름(닉네임)</li>
          <li>보유 및 이용 기간: 회원 탈퇴 시까지</li>
        </ul>
        <p>
          위 경우를 제외하고 회사는 회원의 사전 동의 없이 개인정보를 제3자에게 제공하지 않습니다.
          다만, 관련 법령에 따라 수사기관의 요청이 있는 등 법령에서 정한 예외적인 경우는 그러하지
          아니합니다. 제3자 제공 동의는 마이페이지에서 언제든지 철회할 수 있습니다.
        </p>
      </PolicySection>

      <PolicySection title="5. 개인정보 처리 위탁">
        <p>회사는 원활한 서비스 제공을 위해 다음과 같이 개인정보 처리를 위탁하고 있습니다.</p>
        {/* 디자인(Figma 4694:5101)의 표 — 머리글 행만 gray700 으로 채우고 선도 같은 색이다.
            셀 높이는 24px 이지만 긴 위탁 업무가 두 줄이 될 수 있어 최소 높이로만 둔다. */}
        <table className="w-full table-fixed border border-night-card text-[12px] leading-5">
          <thead className="bg-night-card">
            <tr>
              <th className="h-6 px-2 text-left font-normal">수탁업체</th>
              <th className="h-6 px-2 text-left font-normal">위탁 업무</th>
            </tr>
          </thead>
          <tbody>
            {PROCESSORS.map((processor) => (
              <tr key={processor.name} className="border-t border-night-card">
                <td className="h-6 px-2 align-middle">{processor.name}</td>
                <td className="h-6 px-2 align-middle">{processor.task}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-[12px] leading-5">
          ※ 수탁업체 및 위탁 업무가 변경되는 경우 본 방침을 통해 고지합니다.
        </p>
      </PolicySection>

      <PolicySection title="6. 개인정보의 파기 절차 및 방법">
        <ol className="list-decimal space-y-1 pl-5">
          <li>
            보유 기간이 경과하거나 처리 목적이 달성된 경우, 회사는 지체 없이 해당 정보를 파기합니다.
          </li>
          <li>
            전자적 파일 형태의 정보는 복구할 수 없는 기술적 방법으로 삭제하며, 출력물 등은 분쇄 또는
            소각하여 파기합니다.
          </li>
        </ol>
      </PolicySection>

      <PolicySection title="7. 회원의 권리 및 행사 방법">
        <ol className="list-decimal space-y-1 pl-5">
          <li>
            회원은 언제든지 자신의 개인정보를 조회·수정할 수 있으며, 회원 탈퇴를 통해 개인정보 처리
            정지를 요청할 수 있습니다.
          </li>
          <li>
            마케팅 정보 수신 동의는 마이페이지에서 언제든지 철회할 수 있으며, 철회는 즉시
            반영됩니다.
          </li>
          <li>
            그 밖의 권리 행사는 고객센터({BUSINESS.email})로 요청할 수 있으며, 회사는 지체 없이
            조치합니다.
          </li>
        </ol>
      </PolicySection>

      <PolicySection title="8. 개인정보의 안전성 확보 조치">
        <ol className="list-decimal space-y-1 pl-5">
          <li>관리적 조치: 내부 관리계획 수립·운영, 접근 권한 최소화</li>
          <li>기술적 조치: 전송 구간 암호화(HTTPS), 인증 토큰의 httpOnly 쿠키 보관, 접근 통제</li>
          <li>물리적 조치: 데이터센터의 출입 통제 (위탁사 정책 준용)</li>
        </ol>
      </PolicySection>

      <PolicySection title="9. 쿠키 및 유사 기술의 사용">
        <p>
          회사는 로그인 유지 및 서비스 제공을 위해 쿠키를 사용합니다. 회원은 브라우저 설정을 통해
          쿠키 저장을 거부할 수 있으나, 이 경우 로그인 등 일부 서비스 이용에 제약이 발생할 수
          있습니다.
        </p>
      </PolicySection>

      <PolicySection title="10. 개인정보 보호책임자">
        <p>
          회사는 개인정보 처리에 관한 업무를 총괄하고, 개인정보 처리와 관련한 회원의 불만 처리 및
          피해 구제 등을 위하여 아래와 같이 개인정보 보호책임자를 지정합니다.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>개인정보 보호책임자: {BUSINESS.ceo}</li>
          <li>이메일: {BUSINESS.email}</li>
        </ul>
      </PolicySection>

      <PolicySection title="11. 권익 침해 구제 방법">
        <p>개인정보 침해에 대한 신고나 상담이 필요한 경우 아래 기관에 문의하실 수 있습니다.</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>개인정보분쟁조정위원회: 1833-6972 (privacy.go.kr)</li>
          <li>개인정보침해신고센터: 118 (privacy.kisa.or.kr)</li>
          <li>대검찰청 사이버수사과: 1301 (spo.go.kr)</li>
          <li>경찰청 사이버수사국: 182 (ecrm.police.go.kr)</li>
        </ul>
      </PolicySection>

      <PolicySection title="12. 개인정보처리방침의 변경">
        <p>
          본 방침은 법령·정책 또는 보안 기술의 변경에 따라 내용의 추가·삭제 및 수정이 있을 수
          있으며, 변경 시 최소 7일 전(중대한 변경의 경우 30일 전)에 서비스 내 공지를 통해
          안내합니다.
        </p>
      </PolicySection>

      {/* 사업자 정보 — 디자인(Figma 4694:5158)은 목록이 아니라 줄글이다. 값은 lib/business.ts 에서만 온다 */}
      <PolicySection>
        <address className="not-italic">
          <span className="block">사업자명 : {BUSINESS.name}</span>
          <span className="block">대표자 : {BUSINESS.ceo}</span>
          <span className="block">사업자등록번호 : {BUSINESS.registrationNumber}</span>
          <span className="block">통신판매업신고번호 : {BUSINESS.mailOrderNumber}</span>
          <span className="block">영업소 소재지 : {BUSINESS.address}</span>
          <span className="block">고객센터 : {BUSINESS.email}</span>
        </address>
      </PolicySection>
    </PolicyPage>
  );
}
