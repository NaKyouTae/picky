import { PolicyPage, PolicySection } from '@/components/policy-page';
import { BUSINESS } from '@/lib/business';

export const metadata = { title: '개인정보처리방침 · Picky' };

/** 개인정보 처리 위탁 현황 — 바뀌면 이 표와 시행일자를 함께 고친다. */
const PROCESSORS = [
  { name: 'Supabase', task: '회원 정보 데이터베이스 운영, 인증 사진·콜라주 이미지 저장' },
  { name: '토스페이먼츠', task: '웹 유료 회원권 결제 및 환불 처리' },
  { name: 'Apple Inc.', task: 'iOS 앱 내 유료 회원권 결제 및 환불 처리' },
  { name: 'Vercel, 클라우드타입', task: '서비스 호스팅' },
];

export default function PrivacyPage() {
  return (
    <PolicyPage
      title="개인정보처리방침"
      effectiveDate="2026년 10월 2일"
      addendum="부칙: 본 개인정보처리방침은 2026년 10월 2일부터 시행됩니다. 종전 방침(2026년 9월 21일 시행)은 본 방침의 시행일까지 적용됩니다."
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
              <li>
                필수: 이름, 휴대전화번호, 소셜 로그인 식별자(카카오·네이버 회원번호, Apple 사용자
                식별자)
              </li>
              <li>선택: 이메일 주소, 성별, 연령대, 생년월일</li>
            </ul>
            <p className="mt-1 text-[12px] leading-5">
              ※ 선택 항목은 로그인 시 이용자가 제공에 동의한 경우에만 전달되며, 동의하지 않아도
              회원가입과 서비스 이용에 제한이 없습니다. 소셜 로그인 제공자가 필수 항목을 전달하지
              않는 경우(예: Apple 로그인의 휴대전화번호)에는 서비스 내 입력 화면에서 회원에게 직접
              입력받습니다.
            </p>
          </li>
          <li>
            <p>서비스 이용 시</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>고른 카테고리, 뽑힌 챌린지, 진행·완료·종료 시각 등 챌린지 기록</li>
              <li>회원이 올린 챌린지 인증 사진 및 이를 모아 완성한 콜라주 이미지</li>
              <li>문의하기 이용 시 문의 내용, 답변 받을 이메일 주소, 회원이 첨부한 이미지</li>
            </ul>
          </li>
          <li>
            <p>유료 회원권 결제 시</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>주문번호, 결제 금액, 결제 수단, 결제·취소·환불 일시</li>
              <li>결제대행사에 전달하는 구매자명 및 이메일 주소</li>
            </ul>
            <p className="mt-1 text-[12px] leading-5">
              ※ 카드번호·계좌번호 등 결제 수단 정보는 결제대행사(토스페이먼츠) 또는 Apple이 직접
              처리하며, 회사는 이를 수집·보관하지 않습니다.
            </p>
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
          <li>
            휴대전화번호: 회원 식별의 기준으로 사용합니다. 회사는 카카오·네이버·Apple 로그인을 모두
            제공하므로, 같은 회원이 다른 수단으로 로그인해도 하나의 계정으로 이어지도록 하고, 중복
            가입 및 부정 이용을 막으며, 결제·환불 문의 시 본인 여부를 확인합니다.
          </li>
          <li>
            이름: 유료 회원권 결제 시 구매자명으로 사용하고, 결제·환불 문의 응대와 법령상 거래기록
            보관에 이용합니다.
          </li>
          <li>이메일 주소: 공지사항 전달 및 문의 답변 등 연락 수단으로 이용합니다.</li>
          <li>
            성별·연령대·생년월일: 이용자 분포를 파악하여 챌린지 콘텐츠를 구성하는 등 통계 분석에
            이용합니다.
          </li>
          <li>챌린지 기록 및 인증 사진: 챌린지 진행 상태와 콜라주 결과물을 제공합니다.</li>
          <li>회원가입 의사 확인 및 계정 관리, 서비스 품질 개선</li>
          <li>마케팅 정보 수신에 동의한 회원에 한하여 신규 기능·이벤트 안내</li>
        </ol>
      </PolicySection>

      <PolicySection title="3. 개인정보의 보유 및 이용 기간">
        <ol className="list-decimal space-y-1 pl-5">
          <li>
            회원 탈퇴 시 회사가 수집한 개인정보는 지체 없이 파기하는 것을 원칙으로 합니다. 챌린지
            인증 사진과 완성한 콜라주 이미지도 함께 삭제됩니다.
          </li>
          <li>
            접속 로그는 호스팅 서비스의 보관 정책에 따라 일정 기간 보관된 뒤 자동으로 삭제됩니다.
          </li>
          <li>
            유료 회원권의 결제·청약철회에 관한 기록은 탈퇴 여부와 관계없이 관련 법령이 정한
            기간(전자상거래법상 계약·청약철회 기록 5년, 대금 결제 기록 5년, 소비자 불만·분쟁 처리
            기록 3년) 동안 보관한 뒤 파기합니다.
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
          <li>제공받는 자: 주식회사 카카오, 네이버 주식회사, Apple Inc. (소셜 로그인 제공자)</li>
          <li>제공 목적: 간편 로그인 인증 및 회원 탈퇴 시 계정 연결 해제</li>
          <li>제공 항목: 회원이 로그인에 사용한 제공자의 소셜 로그인 식별자(회원번호)</li>
          <li>보유 및 이용 기간: 회원 탈퇴 시 연결 해제 후 지체 없이 파기</li>
        </ul>
        <p className="text-[12px] leading-5">
          ※ Apple Inc.는 미국에 소재하며, 로그인 인증을 위해 위 항목이 국외로 이전될 수 있습니다.
        </p>
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
          ※ Supabase Inc., Apple Inc., Vercel Inc.는 미국에 소재하며, 위 업무 수행에 필요한 범위에서
          개인정보가 국외로 이전됩니다. 이전 시점은 서비스 이용 시점이고, 이전 방법은 네트워크를
          통한 전송입니다.
        </p>
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
          <li>
            기술적 조치: 전송 구간 암호화(HTTPS), 인증 토큰의 httpOnly 쿠키 보관, 소셜 로그인 제공자
            토큰의 암호화 보관, 인증 사진·콜라주 이미지의 비공개 저장소 보관 및 접근 통제
          </li>
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
