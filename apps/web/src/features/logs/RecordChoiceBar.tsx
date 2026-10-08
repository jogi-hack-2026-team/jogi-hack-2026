import { ChoiceButton } from '../../ui/components/ChoiceButton.tsx';
import { StickyActionBar } from '../../ui/components/StickyActionBar.tsx';
import { todayCopy } from '../../copy/today.ts';

/**
 * 今日の記録の2択（やった／今日は休む）。画面の下に固定し、スクロールに追従する。
 * 予測の表示が失敗しても操作できるよう、予測の Error Boundary の外に置く。
 * 保存の動き（#79）は限定先行の範囲外なので、いまは onSelect に開発用の案内を渡す。
 */
export function RecordChoiceBar({ sessionLabel, onSelect }: { sessionLabel: string; onSelect: (status: 'DONE' | 'SKIPPED') => void }) {
  return (
    <StickyActionBar columns={2}>
      <ChoiceButton kind="done" label={todayCopy.choiceDone} sublabel={sessionLabel} onClick={() => onSelect('DONE')} />
      <ChoiceButton kind="rest" label={todayCopy.choiceRest} onClick={() => onSelect('SKIPPED')} />
    </StickyActionBar>
  );
}
