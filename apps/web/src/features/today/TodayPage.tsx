import { useQuery } from '@tanstack/react-query';
import { Link, useLocation } from '@tanstack/react-router';
import { useState } from 'react';
import type { Goal, Log, Today } from '@contracts';
import { ApiError } from '../../api/client.ts';
import { goalKeys, goalsHttp } from '../../api/goals-http.ts';
import { isNotFound, isUnauthenticated } from '../../api/http.ts';
import { todayHttp, todayKeys } from '../../api/today-http.ts';
import { AppBar } from '../../ui/components/AppBar.tsx';
import { Button } from '../../ui/components/Button.tsx';
import { ErrorPanel } from '../../ui/components/Notice.tsx';
import { Icon } from '../../ui/components/Icon.tsx';
import { Spinner } from '../../ui/components/Spinner.tsx';
import { todayCopy, unitLabel } from '../../copy/today.ts';
import { assertForecastPresentation } from '../prior/PriorForecast.tsx';
import { RecordChoiceBar } from '../logs/RecordChoiceBar.tsx';
import { YesterdayPrompt } from '../logs/YesterdayPrompt.tsx';
import { CoreMetric } from './CoreMetric.tsx';
import { ForecastBoundary } from './ForecastBoundary.tsx';
import { OutlookPanel } from './OutlookPanel.tsx';
import { ProgressSummary } from './ProgressSummary.tsx';
import { AchievedPanel, RecordedSummary } from './RecordedSummary.tsx';
import { fetchPolicy } from './fetch-policy.ts';
import { toForecastView } from './forecast-view.ts';
import { showYesterdayPrompt } from './yesterday-later.ts';
import '../../ui/tokens.css';
import './today.css';

/**
 * Today Decision 画面（R-05〜R-08）。/goals/$goalId
 * 同じルートで goalId だけが変わると部品が使い回されるため、Goal ごとに作り直して
 * 「後で答える」や開発用の案内を別の Goal へ持ち越さない。
 */
export function TodayPage({ goalId }: { goalId: string }) {
  return <TodayScreen key={goalId} goalId={goalId} />;
}

function TodayScreen({ goalId }: { goalId: string }) {
  const goalQuery = useQuery({ queryKey: goalKeys.detail(goalId), queryFn: () => goalsHttp.getGoal(goalId), ...fetchPolicy });
  const todayQuery = useQuery({ queryKey: todayKeys.today(goalId), queryFn: () => todayHttp.getToday(goalId), ...fetchPolicy });
  const logsQuery = useQuery({ queryKey: todayKeys.logs(goalId), queryFn: () => todayHttp.listLogs(goalId), ...fetchPolicy });
  // 保存の動き（#79・#80）はまだつないでいない。押したことが分かるよう、開発用の案内だけを出す。
  const [devNotice, setDevNotice] = useState<string | null>(null);
  // 「後で答える」を押したときの対象日。日付が変われば問いかけを出し直す
  const [yesterdayLaterFor, setYesterdayLaterFor] = useState<string | null>(null);
  const notConnected = () => setDevNotice(todayCopy.saveNotConnected);

  if (isNotFound(goalQuery.error) || isNotFound(todayQuery.error)) return <NotFound />;

  const goal = goalQuery.data;
  const today = todayQuery.data;
  const unit = goal ? unitLabel(goal.unit) : '';
  const sessionLabel = goal ? `${goal.sessionAmount.toLocaleString('ja-JP')}${unit}` : '';
  // 記録の2択を出すか：今日が未記録で、まだ達成していないとき（API の値だけで決める）
  const showChoices = today
    ? today.prediction.todayStatus === 'UNRECORDED' && !today.prediction.progress.completed
    : goal?.todayStatus === 'UNRECORDED';

  return (
    <div className="fr fr-page">
      <AppBar
        title={goal?.title ?? ''}
        leading={
          <Link to="/" className="fr-icon-btn" aria-label="Goal一覧へ戻る">
            <Icon name="back" />
          </Link>
        }
        // Goal のメニュー（編集・削除）は #78 で追加する
      />
      {today && showYesterdayPrompt(today, yesterdayLaterFor) ? (
        <YesterdayPrompt yesterday={today.yesterday} sessionLabel={sessionLabel} onAnswer={notConnected} onLater={() => setYesterdayLaterFor(today.yesterday)} />
      ) : null}

      {goalQuery.isPending || todayQuery.isPending || logsQuery.isPending ? (
        <Loading />
      ) : todayQuery.isError || goalQuery.isError || logsQuery.isError ? (
        <FetchError error={todayQuery.error ?? goalQuery.error ?? logsQuery.error} onRetry={() => void Promise.all([goalQuery.refetch(), todayQuery.refetch(), logsQuery.refetch()])} />
      ) : goal && today && logsQuery.data ? (
        <ForecastBoundary key={todayQuery.dataUpdatedAt}>
          <TodayContent goal={goal} today={today} logs={logsQuery.data} onChange={notConnected} />
        </ForecastBoundary>
      ) : null}

      {devNotice ? (
        <p className="fr-dev-notice" role="status">
          {devNotice}
        </p>
      ) : null}
      {showChoices ? <RecordChoiceBar sessionLabel={sessionLabel} onSelect={notConnected} /> : null}
    </div>
  );
}

function TodayContent({ goal, today, logs, onChange }: { goal: Goal; today: Today; logs: Log[]; onChange: () => void }) {
  // 変換と検査は Boundary の内側で行う（失敗しても記録の2択は残る）
  const view = toForecastView(today.prediction, goal.unit);
  assertForecastPresentation(view);
  const unit = unitLabel(goal.unit);
  const progress =
    view.kind === 'completed' || view.kind === 'forecast' || view.kind === 'today-recorded' ? (
      <ProgressSummary progress={view.progress} initialProgress={goal.initialProgress} logs={logs} recordStartDate={goal.recordStartDate} today={today.today} />
    ) : null;
  const outlookTitle = todayCopy.outlookTitle(goal.totalRequired, unit);

  switch (view.kind) {
    case 'completed':
      return (
        <>
          <AchievedPanel total={view.progress.total} unit={unit} />
          {progress}
        </>
      );
    case 'today-recorded':
      return (
        <>
          {today.todayLog ? <RecordedSummary todayLog={today.todayLog} unit={unit} onChange={onChange} /> : null}
          <OutlookPanel completion={view.completion} today={today.today} title={outlookTitle} />
          {progress}
        </>
      );
    case 'forecast':
      return (
        <>
          <section className="fr-today__top" aria-labelledby="fr-question">
            <h1 id="fr-question" className="fr-today__question">
              {todayCopy.question}
            </h1>
            <CoreMetric core={view.core} resumed={view.resumed} />
          </section>
          <OutlookPanel completion={view.completion} today={today.today} title={outlookTitle} />
          {progress}
        </>
      );
    default:
      // loading・error など取得側の状態は、この部品に渡さない（親で扱う）
      throw new TypeError(`Today の表示データとして想定していない状態です: ${view.kind}`);
  }
}

function Loading() {
  return (
    <div className="fr-today__top">
      <h1 className="fr-today__question">{todayCopy.question}</h1>
      <p className="fr-loading" role="status">
        <Spinner />
        {todayCopy.loading}
      </p>
    </div>
  );
}

function FetchError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  if (isUnauthenticated(error)) return <SignedOut />;
  // 計算の失敗（500 PREDICTION_FAILED）と通信の失敗を分け、どちらもデータ不足とは別の見た目にする
  const calc = error instanceof ApiError && error.body?.error.code === 'PREDICTION_FAILED';
  return (
    <div className="fr-today__top">
      <h1 className="fr-today__question">{todayCopy.question}</h1>
      <ErrorPanel
        title={calc ? todayCopy.calcErrorTitle : todayCopy.networkErrorTitle}
        action={
          <Button icon="retry" onClick={onRetry}>
            {todayCopy.reload}
          </Button>
        }
      >
        {calc ? todayCopy.calcError : todayCopy.networkError}
      </ErrorPanel>
    </div>
  );
}

function NotFound() {
  return (
    <div className="fr fr-page">
      <AppBar title="" />
      <div className="fr-today__top">
        <h1 className="fr-today__question">{todayCopy.notFoundTitle}</h1>
        <ErrorPanel
          title={todayCopy.notFoundPanel}
          action={
            <Link to="/" className="fr-btn fr-btn--secondary">
              {todayCopy.backToGoals}
            </Link>
          }
        >
          {todayCopy.notFound}
        </ErrorPanel>
      </div>
    </div>
  );
}

/** ログインが切れた（API が 401 を返した）。ログイン後にこの画面へ戻れるよう、今の場所を渡す。 */
function SignedOut() {
  const location = useLocation();
  return (
    <div className="fr-today__top">
      <h1 className="fr-today__question">{todayCopy.question}</h1>
      <ErrorPanel
        title={todayCopy.signedOutTitle}
        action={
          <Link to="/login" search={{ redirect: location.href }} className="fr-btn fr-btn--secondary">
            {todayCopy.signIn}
          </Link>
        }
      >
        {todayCopy.signedOut}
      </ErrorPanel>
    </div>
  );
}
