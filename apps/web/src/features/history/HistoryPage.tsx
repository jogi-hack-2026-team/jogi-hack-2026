import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { goalKeys, goalsHttp } from '../../api/goals-http.ts';
import { isNotFound } from '../../api/http.ts';
import { todayHttp, todayKeys } from '../../api/today-http.ts';
import { appCopy } from '../../copy/app.ts';
import { todayCopy } from '../../copy/today.ts';
import { AppBar } from '../../ui/components/AppBar.tsx';
import { Icon } from '../../ui/components/Icon.tsx';
import { PageTitle } from '../../ui/components/PageTitle.tsx';
import { Spinner } from '../../ui/components/Spinner.tsx';
import { GoalNotFoundPanel, LoadErrorPanel } from '../goals/GoalStates.tsx';
import { fetchPolicy } from '../today/fetch-policy.ts';
import { dayState, monthCells, shiftMonth } from './calendar.ts';
import { DayMark } from './DayMark.tsx';
import '../../ui/tokens.css';
import '../../ui/page.css';
import '../../ui/components/Button.css';
import './history.css';

const c = todayCopy;
const WEEKDAYS = ['月', '火', '水', '木', '金', '土', '日'];

/**
 * 記録の履歴（デザイン F1）。/goals/$goalId/history
 * 月ごとのカレンダーに、やった・休んだ・未記録（休んだとは別）を出す。記録開始日の月から今日の月まで移れる。
 * Goal（記録開始日・今日）と記録の一覧は Today と同じキャッシュを使い、表示のために計算し直さない。
 */
export function HistoryPage({ goalId }: { goalId: string }) {
  const goalQuery = useQuery({ queryKey: goalKeys.detail(goalId), queryFn: ({ signal }) => goalsHttp.getGoal(goalId, signal), ...fetchPolicy });
  const logsQuery = useQuery({ queryKey: todayKeys.logs(goalId), queryFn: ({ signal }) => todayHttp.listLogs(goalId, signal), ...fetchPolicy });
  const [month, setMonth] = useState<string | null>(null);

  const goal = goalQuery.data;
  const logs = logsQuery.data;
  const error = goalQuery.error ?? logsQuery.error;
  const back = (
    <Link to="/goals/$goalId" params={{ goalId }} className="fr-icon-btn" aria-label={c.backToGoal}>
      <Icon name="back" />
    </Link>
  );

  if (!goal || !logs) {
    return (
      <div className="fr fr-page">
        <PageTitle title={c.historyTitle} />
        <AppBar title={c.historyTitle} leading={back} />
        <div className="fr-history__pad">
          {isNotFound(error) ? (
            <GoalNotFoundPanel />
          ) : error ? (
            <LoadErrorPanel error={error} onRetry={() => void Promise.all([goalQuery.refetch(), logsQuery.refetch()])} />
          ) : (
            <p className="fr-history__legend" role="status">
              <Spinner />
              {appCopy.loading}
            </p>
          )}
        </div>
      </div>
    );
  }

  const first = goal.recordStartDate.slice(0, 7);
  const last = goal.today.slice(0, 7);
  const shown = month ?? last;
  return (
    <div className="fr fr-page">
      <PageTitle title={`${c.historyTitle}（${goal.title}）`} />
      <AppBar title={c.historyTitle} leading={back} />
      <section className="fr-history__top">
        <div className="fr-history__month">
          <button type="button" className="fr-icon-btn" aria-label={c.prevMonth} disabled={shown <= first} onClick={() => setMonth(shiftMonth(shown, -1))}>
            <Icon name="back" />
          </button>
          <h1 aria-live="polite">{c.monthLabel(shown)}</h1>
          <button type="button" className="fr-icon-btn" aria-label={c.nextMonth} disabled={shown >= last} onClick={() => setMonth(shiftMonth(shown, 1))}>
            <Icon name="chevronRight" />
          </button>
        </div>
        <p className="fr-history__legend">
          <span>
            <DayMark state="done" size={24} />
            {c.dayStateLabel.done}
          </span>
          <span>
            <DayMark state="rest" size={24} />
            {c.dayStateLabel.rest}
          </span>
          <span>
            <DayMark state="unrecorded" size={24} />
            {c.legendUnrecorded}
          </span>
        </p>
      </section>
      <ul className="fr-history__cal" aria-label={c.monthLabel(shown)}>
        {WEEKDAYS.map((w) => (
          <li key={w} className="fr-history__wd" aria-hidden="true">
            {w}
          </li>
        ))}
        {monthCells(shown).map((date, i) => {
          if (date === null) return <li key={`pad-${i}`} aria-hidden="true" />;
          const state = dayState(date, logs, goal.recordStartDate, goal.today);
          const day = Number(date.slice(8, 10));
          const label = `${Number(date.slice(5, 7))}月${day}日${state === 'outside' ? '' : ` ${c.dayStateLabel[state]}`}`;
          return (
            <li key={date} className="fr-history__day" aria-label={label}>
              <DayMark state={state} size={36} />
              <span aria-hidden="true">{day}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
