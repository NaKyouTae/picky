/** 디자인(4694:4571)의 혜택 4장 — 문구는 디자인 그대로다 */
const BENEFITS: { title: string; description: string; highlight?: string }[] = [
  {
    title: '더 다양한 콜라주',
    description: '모든 콜라주 템플릿을 자유롭게 이용해보세요.',
    highlight: '새로운 템플릿도 계속 추가될 예정이에요 !',
  },
  {
    title: '언제든 다시 저장',
    description: '완료한 챌린지의 콜라주를 언제든 다시 다운로드하고 간직할 수 있어요.',
  },
  {
    title: '더 선명하게 저장',
    description: '소중한 순간을 고화질 그대로 저장하고 공유할 수 있어요.',
  },
  {
    title: '사진만 깔끔하게',
    description: '워터마크 없이 온전히 나만의 콜라주로 저장할 수 있어요.',
  },
];

/** 회원권으로 열리는 것들 — 웹·앱 구매 화면이 같이 쓴다 */
export function MembershipBenefits() {
  return (
    <section className="flex w-full flex-col gap-4">
      <h2 className="text-[14px] leading-none text-night-sub">혜택 살펴보기</h2>

      <ul className="flex flex-col gap-[10px]">
        {BENEFITS.map((benefit) => (
          <li key={benefit.title} className="flex flex-col gap-4 rounded-lg bg-night-card p-5">
            <h3 className="text-[16px] font-medium leading-none">{benefit.title}</h3>
            <p className="text-[14px] leading-[1.6]">
              {benefit.description}
              {/* 덧붙이는 문구는 줄을 바꿔 시작한다 — 본문 끝에 붙어 흐르지 않도록 */}
              {benefit.highlight && <span className="block text-point">{benefit.highlight}</span>}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
