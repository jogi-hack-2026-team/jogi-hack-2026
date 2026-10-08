import { Button } from '../../ui/components/Button.tsx';
import { longDate } from '../../copy/date.ts';
import { todayCopy } from '../../copy/today.ts';
import './logs.css';

/**
 * 「昨日はどうでしたか？」（R-04）。出す条件は /today の yesterdayMissing だけを見る（開始日の条件は API 側で含める）。
 * 保存の動き（#80）は限定先行の範囲外なので、いまは onAnswer に開発用の案内を渡す。「後で答える」はデータを作らない。
 */
export function YesterdayPrompt({
  yesterday,
  sessionLabel,
  onAnswer,
  onLater,
}: {
  yesterday: string;
  sessionLabel: string;
  onAnswer: (status: 'DONE' | 'SKIPPED') => void;
  onLater: () => void;
}) {
  return (
    <section className="fr-yesterday" aria-labelledby="fr-yesterday-title">
      <div className="fr-yesterday__head">
        <h2 id="fr-yesterday-title" className="fr-yesterday__title">
          {todayCopy.yesterdayQuestion}
        </h2>
        <span className="fr-yesterday__date">{longDate(yesterday)}</span>
      </div>
      <div className="fr-yesterday__pair">
        <Button icon="check" onClick={() => onAnswer('DONE')}>
          {todayCopy.yesterdayDone}
        </Button>
        <Button icon="moon" onClick={() => onAnswer('SKIPPED')}>
          {todayCopy.yesterdayRest}
        </Button>
      </div>
      <p className="fr-yesterday__amount">やった量：{sessionLabel}</p>
      <Button variant="text" onClick={onLater}>
        {todayCopy.yesterdayLater}
      </Button>
    </section>
  );
}
