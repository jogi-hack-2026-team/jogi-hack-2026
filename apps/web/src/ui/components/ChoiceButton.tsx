import type { ButtonHTMLAttributes } from 'react';
import { Icon } from './Icon.tsx';
import { Spinner } from './Spinner.tsx';
import './ChoiceButton.css';

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'style' | 'children'> & {
  /** done＝やった、rest＝休む。2つは同じ形・同じ大きさ・同じ色にする（どちらかを勧めない）。 */
  kind: 'done' | 'rest';
  label: string;
  /** 「やった」の下に出す1回の量など。 */
  sublabel?: string;
  /** 今の記録として選ばれている（記録の変更時）。 */
  selected?: boolean;
  /** この選択を保存している。押せなくし、ラベルを「保存中…」に替える（busyLabel）。 */
  busy?: boolean;
  busyLabel?: string;
};

export function ChoiceButton({ kind, label, sublabel, selected, busy = false, busyLabel, disabled, type = 'button', ...rest }: Props) {
  return (
    <button
      {...rest}
      type={type}
      className={`fr-choice${selected ? ' fr-choice--selected' : ''}${busy ? ' fr-choice--busy' : ''}`}
      aria-pressed={selected}
      aria-busy={busy || undefined}
      disabled={disabled === true || busy}
    >
      <span className="fr-choice__label">
        {busy ? <Spinner /> : <Icon name={kind === 'done' ? 'check' : 'moon'} strokeWidth={2} />}
        {busy && busyLabel ? busyLabel : label}
      </span>
      {/* 高さをそろえるため、補足がなくても行を残す */}
      <span className="fr-choice__sub">{sublabel ?? '​'}</span>
    </button>
  );
}
