import { Icon } from './Icon.tsx';
import './StatusBadge.css';

const text = { done: 'やった', rest: '休んだ', unrecorded: '未記録' } as const;

// 記録状態のバッジ。色だけに頼らず、形（塗り＋チェック／塗り＋月／破線）でも区別する。
export function StatusBadge({ status, large = false }: { status: keyof typeof text; large?: boolean }) {
  return (
    <span className={`fr-badge fr-badge--${status}${large ? ' fr-badge--large' : ''}`}>
      {status === 'unrecorded' ? null : <Icon name={status === 'done' ? 'check' : 'moon'} size={large ? 18 : 15} strokeWidth={2.2} />}
      {text[status]}
    </span>
  );
}
