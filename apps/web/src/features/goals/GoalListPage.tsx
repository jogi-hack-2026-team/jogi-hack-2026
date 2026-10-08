import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import type { Goal } from '@contracts';
import { goalKeys, goalsHttp } from '../../api/goals-http.ts';
import { goalsCopy } from '../../copy/goals.ts';
import { longDate } from '../../copy/date.ts';
import { unitLabel } from '../../copy/today.ts';
import { Icon } from '../../ui/components/Icon.tsx';
import { StatusBadge } from '../../ui/components/StatusBadge.tsx';
import { Band } from '../../ui/components/Section.tsx';
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

function GoalRow({ goal }: { goal: Goal }) {
  const unit = unitLabel(goal.unit);
  const amount = (n: number) => `${n.toLocaleString('ja-JP')}${unit}`;
  return (
    <li className="fr-goals__row">
      <Link to="/goals/$goalId" params={{ goalId: goal.id }} className="fr-goals__open">
        <span className="fr-goals__row-top">
          <span className="fr-goals__title">{goal.title}</span>
          <StatusBadge status={badge[goal.todayStatus]} />
        </span>
        <span className="fr-goals__row-sub">
          <span>{c.todayStatus[goal.todayStatus]}</span>
          <span className="fr-goals__amount">{c.settingsLine(amount(goal.sessionAmount), amount(goal.totalRequired))}</span>
        </span>
      </Link>
      <Link to="/goals/$goalId/edit" params={{ goalId: goal.id }} className="fr-icon-btn fr-goals__edit" aria-label={`「${goal.title}」を編集`}>
        <Icon name="edit" size={20} />
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
