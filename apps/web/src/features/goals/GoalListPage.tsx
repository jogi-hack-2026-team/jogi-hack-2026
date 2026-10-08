import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import type { Goal } from '@contracts';
import { goalKeys, goalsHttp } from '../../api/goals-http.ts';
import { appCopy } from '../../copy/app.ts';
import { goalsCopy } from '../../copy/goals.ts';
import { longDate } from '../../copy/date.ts';
import { unitLabel } from '../../copy/today.ts';
import { AppBar } from '../../ui/components/AppBar.tsx';
import { Icon } from '../../ui/components/Icon.tsx';
import { PageTitle } from '../../ui/components/PageTitle.tsx';
import { StatusBadge } from '../../ui/components/StatusBadge.tsx';
import { Band } from '../../ui/components/Section.tsx';
import { AccountMenu } from '../account/AccountMenu.tsx';
import { fetchPolicy } from '../today/fetch-policy.ts';
import { LoadErrorPanel } from './GoalStates.tsx';
import '../../ui/tokens.css';
import '../../ui/page.css';
import '../../ui/components/Button.css';
import './goals.css';

const c = goalsCopy;
const badge = { DONE: 'done', SKIPPED: 'rest', UNRECORDED: 'unrecorded' } as const;

/** 端末の今日（YYYY-MM-DD）。一覧の日付の見出しだけに使う（各Goalの「今日」は API が Goal の timezone で返す）。 */
function browserToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Goal 一覧（R-02、#78）。/goals */
export function GoalListPage() {
  const query = useQuery({ queryKey: goalKeys.list(), queryFn: ({ signal }) => goalsHttp.listGoals(signal), ...fetchPolicy });

  return (
    <div className="fr fr-page">
      <PageTitle title={c.listTitle} />
      {/* 上のバー：アプリ名とアカウント（デザイン B-home・B-account） */}
      <AppBar title={appCopy.name} trailing={<AccountMenu />} />
      <section className="fr-goals__top">
        <p className="fr-goals__date">{longDate(browserToday())}</p>
        <h1 className="fr-goals__heading">{c.listTitle}</h1>
      </section>

      {query.isPending ? (
        <ListLoading />
      ) : query.isError ? (
        <div className="fr-goals__pad">
          <LoadErrorPanel error={query.error} onRetry={() => void query.refetch()} />
        </div>
      ) : query.data.length === 0 ? (
        <EmptyGoals />
      ) : (
        <>
          <ul className="fr-goals__list">
            {query.data.map((goal) => (
              <GoalRow key={goal.id} goal={goal} />
            ))}
          </ul>
          <div className="fr-goals__pad">
            <Link to="/goals/new" className="fr-btn fr-btn--secondary fr-btn--block">
              <Icon name="plus" size={18} />
              {c.add}
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * 一覧の1行（デザイン B-home）。行全体で Today を開く。編集は Today の上のバーから。
 * 累計は API の progressDone（Today の予測の累計と同じ数え方）をそのまま出し、FE で計算しない。
 * 進捗バーは総量を超えたら満杯で止める（数字は超えた値のまま出す、R-08）。
 */
function GoalRow({ goal }: { goal: Goal }) {
  const unit = unitLabel(goal.unit);
  const percent = Math.min(100, Math.floor((goal.progressDone / goal.totalRequired) * 100));
  return (
    <li className="fr-goals__row">
      <Link to="/goals/$goalId" params={{ goalId: goal.id }} className="fr-goals__open">
        <span className="fr-goals__row-top">
          <span className="fr-goals__title">{goal.title}</span>
          <span className="fr-goals__row-end">
            <StatusBadge status={badge[goal.todayStatus]} />
            <span className="fr-goals__chevron" aria-hidden="true">
              <Icon name="chevronRight" size={18} />
            </span>
          </span>
        </span>
        <span className="fr-goals__row-sub">
          <span>{c.todayStatus[goal.todayStatus]}</span>
          <span className="fr-goals__amount">
            {goal.progressDone.toLocaleString('ja-JP')}{' '}
            <span className="fr-goals__amount-total">
              / {goal.totalRequired.toLocaleString('ja-JP')}
              {unit}
            </span>
          </span>
        </span>
        <span
          className="fr-goals__track"
          role="progressbar"
          aria-label={c.progressLabel(goal.title)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <span className="fr-goals__fill" style={{ width: `${percent}%` }} />
        </span>
      </Link>
    </li>
  );
}

function EmptyGoals() {
  return (
    <Band labelledBy="fr-goals-empty">
      <h2 className="fr-goals__band-title" id="fr-goals-empty">
        {c.empty.title}
      </h2>
      <p className="fr-goals__body">{c.empty.body}</p>
      <p className="fr-goals__help">{c.empty.examples}</p>
      <Link to="/goals/new" className="fr-btn fr-btn--primary fr-btn--block">
        <Icon name="plus" size={18} />
        {c.empty.action}
      </Link>
    </Band>
  );
}

function ListLoading() {
  return (
    <>
      <p className="fr-sr-only" role="status">
        {c.loading}
      </p>
      <ul className="fr-goals__list" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <li key={i} className="fr-goals__row fr-goals__row--skeleton">
            <span className="fr-skel fr-skel--title" />
            <span className="fr-skel fr-skel--line" />
          </li>
        ))}
      </ul>
    </>
  );
}
