import { Icon } from '../../ui/components/Icon.tsx';
import type { DayState } from './calendar.ts';
import './history.css';

/** 日ごとの記録の印（デザイン F1・P1）。読み上げは親の要素に付け、印そのものは飾りとして隠す。 */
export function DayMark({ state, size }: { state: DayState; size: number }) {
  return (
    <span className={`fr-daymark fr-daymark--${state}`} style={{ width: size, height: size }} aria-hidden="true">
      {state === 'done' ? <Icon name="check" size={Math.round(size * 0.55)} strokeWidth={2.4} /> : null}
      {state === 'rest' ? <Icon name="moon" size={Math.round(size * 0.55)} strokeWidth={2.2} /> : null}
      {state === 'unrecorded' ? <span style={{ fontSize: Math.round(size * 0.38) }}>?</span> : null}
    </span>
  );
}
