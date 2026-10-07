import type { ButtonHTMLAttributes } from 'react';
import { Icon } from './Icon.tsx';
import './ChoiceButton.css';

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'style' | 'children'> & {
  /** done＝やった、rest＝休む。2つは同じ形・同じ大きさ・同じ色にする（どちらかを勧めない）。 */
  kind: 'done' | 'rest';
  label: string;
  /** 「やった」の下に出す1回の量など。 */
  sublabel?: string;
  /** 今の記録として選ばれている（記録の変更時）。 */
  selected?: boolean;
};

export function ChoiceButton({ kind, label, sublabel, selected, type = 'button', ...rest }: Props) {
  return (
    <button {...rest} type={type} className={`fr-choice${selected ? ' fr-choice--selected' : ''}`} aria-pressed={selected}>
      <span className="fr-choice__label">
        <Icon name={kind === 'done' ? 'check' : 'moon'} strokeWidth={2} />
        {label}
      </span>
      {/* 高さをそろえるため、補足がなくても行を残す */}
      <span className="fr-choice__sub">{sublabel ?? '​'}</span>
    </button>
  );
}
