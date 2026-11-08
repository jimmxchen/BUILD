// The BUILD lockup exactly as the app draws it (lockupHTML in src/build/core.js):
// the "b" mark path in its native 273 × 280 box, then "uild" set in Hanken Grotesk 600.
// The mark keeps its aspect ratio at every size; only its fill follows the green site palette.
const MARK_PATH = "M0 62 L101 0 L104 93 L273 153 L273 239 L187 280 L48 280 L176 209 L176 153 L104 116 L104 199 L0 262 Z";

export function Mark({ size = 26, className }: { size?: number; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 273 280" width={size} height={(size * 280) / 273} aria-hidden="true" focusable="false">
      <path d={MARK_PATH} fill="currentColor" />
    </svg>
  );
}

export function Logo({ size = 26 }: { size?: number }) {
  return (
    <span className="bl-logo" style={{ gap: size * 0.06 }}>
      <Mark size={size} className="bl-logo-mark" />
      <span className="bl-logo-word" aria-hidden="true" style={{ fontSize: size * 1.02, marginBottom: -size * 0.08 }}>uild</span>
      <span className="bl-sr">BUILD</span>
    </span>
  );
}
