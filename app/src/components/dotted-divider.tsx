/**
 * 다크 화면(마이페이지·회원권)의 점선 구분선 —
 * 2px 대시·2px 간격(Figma Line 9 / Line 11)을 그대로 재현한다.
 */
export function DottedDivider({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`block h-px w-full shrink-0 ${className ?? ''}`}
      style={{
        backgroundImage:
          'repeating-linear-gradient(to right, var(--color-night-raised) 0 2px, transparent 2px 4px)',
      }}
    />
  );
}
