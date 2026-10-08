import type { ReactNode } from 'react';
import './Section.css';

// 区切りはカードではなく、背景（Section）と面（Band）の切り替えで作る。
type Props = { children: ReactNode; label?: string; labelledBy?: string; ariaLabel?: string };

export function Band({ children, label, labelledBy, ariaLabel }: Props) {
  return (
    <section className="fr-band" aria-labelledby={labelledBy} aria-label={ariaLabel}>
      {label ? <SectionLabel>{label}</SectionLabel> : null}
      {children}
    </section>
  );
}

export function Section({ children, label, labelledBy, ariaLabel }: Props) {
  return (
    <section className="fr-section" aria-labelledby={labelledBy} aria-label={ariaLabel}>
      {label ? <SectionLabel>{label}</SectionLabel> : null}
      {children}
    </section>
  );
}

/** 区切りの小見出し（「これからの見通し」など）。区切りの見出しを兼ねるときは as="h2" と id を渡す。 */
export function SectionLabel({ children, as = 'p', id }: { children: ReactNode; as?: 'p' | 'h2'; id?: string }) {
  const Tag = as;
  return (
    <Tag className="fr-section-label" id={id}>
      {children}
    </Tag>
  );
}

/** 補足の文（灰色の小さい文字）。 */
export function Help({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <p className="fr-help" id={id}>
      {children}
    </p>
  );
}
