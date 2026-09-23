import { ConsentBar } from '@/components/consent-bar';
import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import { getMyConsents } from '@/lib/consents';

export const metadata = { title: '이용약관 · Picky' };

// 로그인 여부에 따라 하단 동의 바가 달라진다.
export const dynamic = 'force-dynamic';

export default async function TermsPage() {
  // 비로그인 상태에서도 약관은 읽을 수 있어야 하므로 막지 않는다.
  const session = await getSession();
  // 동의 바에 쓸 값 — 비로그인이면 바 자체가 없으므로 조회하지 않는다.
  const consents = session ? await getMyConsents() : null;

  return (
    <div className={session ? 'pb-cta flex flex-1 flex-col' : 'pb-page flex flex-1 flex-col'}>
      <PageHeader title="이용약관" />

      <article className="space-y-6 px-5 pb-6 pt-4 text-sm leading-relaxed text-ink-sub">
        <p className="text-right text-xs">시행일자: 2026년 9월 21일</p>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-ink">제1조 (목적)</h2>
          <p>
            본 약관은 스펙트럼(이하 &quot;회사&quot;)이 제공하는 모바일 웹 서비스
            &quot;Picky&quot;(이하 &quot;서비스&quot;)의 이용과 관련하여 회사와 이용자(이하
            &quot;회원&quot;) 간의 권리, 의무 및 책임사항, 기타 필요한 사항을 규정함을 목적으로
            합니다.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-ink">제2조 (정의)</h2>
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              &quot;서비스&quot;란 카테고리를 고르면 챌린지를 뽑아 주고, 진행 기록을 남길 수 있게
              하는 일체의 기능을 의미합니다.
            </li>
            <li>&quot;회원&quot;이란 본 약관에 동의하고 회사와 이용계약을 체결한 자를 말합니다.</li>
            <li>
              &quot;챌린지 그룹&quot;이란 회원이 고른 카테고리에서 뽑힌 챌린지들의 묶음과 그 진행
              상태를 말합니다.
            </li>
          </ol>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-ink">제3조 (약관의 효력 및 변경)</h2>
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              본 약관은 서비스 화면에 게시하거나 기타 방법으로 회원에게 공지함으로써 효력이
              발생합니다.
            </li>
            <li>
              회사는 관련 법령을 위배하지 않는 범위에서 본 약관을 개정할 수 있으며, 개정 시 적용일자
              및 사유를 명시하여 최소 7일 전(회원에게 불리하거나 중대한 변경의 경우 30일 전)에
              공지합니다.
            </li>
            <li>회원이 변경된 약관에 동의하지 않을 경우 이용계약을 해지할 수 있습니다.</li>
          </ol>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-ink">제4조 (회원가입 및 계정)</h2>
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              회원가입은 이용자가 카카오 소셜 로그인으로 가입을 신청하고, 회사가 이를 승낙함으로써
              성립됩니다. 이때 회원은 본 약관과 개인정보처리방침에 동의한 것으로 봅니다.
            </li>
            <li>
              회원은 자신의 계정을 제3자에게 양도·대여할 수 없으며, 계정 관리에 대한 책임은 회원
              본인에게 있습니다.
            </li>
          </ol>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-ink">제5조 (서비스의 제공 및 변경)</h2>
          <ol className="list-decimal space-y-1 pl-5">
            <li>회사는 회원에게 챌린지 추천, 진행 기록 보관 등의 서비스를 제공합니다.</li>
            <li>
              회사는 서비스의 내용, 운영상·기술상 사항 등을 변경할 수 있으며, 변경 시 사전에
              공지합니다.
            </li>
            <li>
              회사는 서비스를 연중무휴 제공하기 위해 노력하나, 시스템 점검·교체 또는 불가항력적
              사유가 있는 경우 일시 중단할 수 있습니다.
            </li>
          </ol>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-ink">제6조 (회원의 의무)</h2>
          <ol className="list-decimal space-y-1 pl-5">
            <li>회원은 관계 법령, 본 약관 및 회사가 공지한 사항을 준수하여야 합니다.</li>
            <li>회원은 타인의 정보를 도용하거나 허위 정보를 입력해서는 안 됩니다.</li>
            <li>
              회원은 서비스를 이용하여 얻은 정보를 회사의 사전 승낙 없이 복제·전송·출판·배포할 수
              없습니다.
            </li>
          </ol>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-ink">제7조 (서비스 이용 제한)</h2>
          <p>
            회사는 회원이 본 약관 또는 관련 법령을 위반한 경우 사전 통지 없이 서비스 이용을 일시
            정지하거나 이용계약을 해지할 수 있습니다.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-ink">제8조 (계약 해지 및 탈퇴)</h2>
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              회원은 언제든지 고객센터(spectrum.mesh@gmail.com)를 통해 이용계약 해지(회원 탈퇴)를
              신청할 수 있습니다.
            </li>
            <li>탈퇴 시 회원의 개인정보는 개인정보처리방침에 따라 처리됩니다.</li>
          </ol>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-ink">제9조 (면책조항)</h2>
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              회사는 천재지변, 불가항력, 회원의 귀책사유로 인한 서비스 이용 장애에 대하여 책임을
              지지 않습니다.
            </li>
            <li>
              서비스가 추천하는 챌린지는 참고용 제안이며, 이를 수행하는 과정에서 발생한 결과에 대한
              책임은 회원에게 있습니다.
            </li>
          </ol>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-ink">제10조 (분쟁 해결 및 준거법)</h2>
          <ol className="list-decimal space-y-1 pl-5">
            <li>본 약관은 대한민국 법령에 따라 해석됩니다.</li>
            <li>
              서비스 이용과 관련하여 회사와 회원 간 분쟁이 발생한 경우, 양 당사자는 성실히 협의하여
              해결하며, 협의가 이루어지지 않을 경우 민사소송법상 관할 법원에 제소할 수 있습니다.
            </li>
          </ol>
        </section>

        <p className="text-right text-xs">부칙: 본 약관은 2026년 9월 21일부터 시행됩니다.</p>
      </article>

      {session && <ConsentBar consentKey="terms" initialConsents={consents} />}
    </div>
  );
}
