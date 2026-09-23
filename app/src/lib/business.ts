/**
 * 사업자 정보 — 전자상거래법 제10조(사업자의 신원 등에 대한 표시) 표시 항목.
 *
 * **여러 화면이 같은 값을 보여주므로 여기에만 둔다.** 예전에는 마이페이지·개인정보처리방침·
 * 환불정책에 각각 하드코딩돼 있어 주소 같은 항목이 통째로 빠져도 드러나지 않았다.
 *
 * 화면 표시는 `components/business-info.tsx` 가 맡는다.
 */
export const BUSINESS = {
  /** 상호명 */
  name: '스펙트럼(spectrum)',
  /** 대표자명 */
  ceo: '나규태',
  registrationNumber: '244-20-02381',
  /** 영업소 소재지 — 전자상거래법상 필수 표시 항목 */
  address: '경기도 남양주시 다산중앙로82번안길 166-46',
  email: 'spectrum.mesh@gmail.com',
  /** 통신판매업 신고번호 — picky 는 유료 회원권을 비대면으로 판매하므로 신고 대상이다 */
  mailOrderNumber: '2026-다산-0719',
} as const;
