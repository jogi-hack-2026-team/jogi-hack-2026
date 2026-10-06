// 画面で使う線のアイコン（デザインキャンバスの共通部品と同じ形）。色は文字色（currentColor）に従う。
const paths = {
  back: <path d="M15 5l-7 7 7 7" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  more: (
    <>
      <circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  moon: <path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6" />
      <path d="M12 7.6v.4" />
    </>
  ),
  offline: (
    <>
      <path d="M3 3l18 18" />
      <path d="M8.5 6.8A6 6 0 0 1 17.6 10a4 4 0 0 1 2.6 6.3" />
      <path d="M16 19H7a4.5 4.5 0 0 1-1.7-8.7" />
    </>
  ),
  retry: (
    <>
      <path d="M20 11a8 8 0 1 0-2.3 5.7" />
      <path d="M20 4.5V11h-6.5" />
    </>
  ),
  chevronDown: <path d="M6 9l6 6 6-6" />,
  edit: <path d="M4 20h4L19 9l-4-4L4 16v4z" />,
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name, size = 22, strokeWidth = 1.8 }: { name: IconName; size?: number; strokeWidth?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths[name]}
    </svg>
  );
}
