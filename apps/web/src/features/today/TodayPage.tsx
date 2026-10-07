import { Link, useLocation } from '@tanstack/react-router';
import { useState } from 'react';
import type { Goal, Log, Today } from '@contracts';
import { ApiError } from '../../api/client.ts';
import { isNotFound, isUnauthenticated } from '../../api/http.ts';
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
import { useTodayData } from './useTodayData.ts';
import { toForecastView } from './forecast-view.ts';
import { useSaveLog } from '../logs/useSaveLog.ts';
import { showYesterdayPrompt } from './yesterday-later.ts';
import { YesterdayCorrection } from '../logs/YesterdayCorrection.tsx';
import { yesterdayRecord } from '../logs/record-log.ts';
import '../../ui/tokens.css';
import '../../ui/page.css';
import './today.css';

/**
 * Today Decision 画面（R-05〜R-08）。/goals/$goalId
 * 同じルートで goalId だけが変わると部品が使い回されるため、Goal ごとに作り直して
 * 「後で答える」や記録の変更中の状態を別の Goal へ持ち越さない。
 */
export function TodayPage({ goalId }: { goalId: string }) {
  return <TodayScreen key={goalId} goalId={goalId} />;
}

function TodayScreen({ goalId }: { goalId: string }) {
  // Goal・Today・記録は同じ時点の材料がそろったものだけを使う（snapshot）。日付の切り替わりでも取り直す
  const { goalQuery, todayQuery, logsQuery, snapshot, resyncFailed, refresh, retryResync } = useTodayData(goalId);
  // 今日の記録（#79）と昨日の補完・訂正（#80）。保存の状態は別々に持つ
  // 記録済みの今日を選び直している（D5-change）。保存に成功したら戻す
  const [changing, setChanging] = useState(false);
  // 記録済みの昨日を訂正している。訂正を始めた時点の記録（対象日）を固定して持つ。今日と同時には編集しない
  const [yesterdayEdit, setYesterdayEdit] = useState<Log | null>(null);
  const todaySaver = useSaveLog(goalId, { onSaved: () => setChanging(false) });
  const yesterdaySaver = useSaveLog(goalId, { onSaved: () => setYesterdayEdit(null) });
  // 「後で答える」を押したときの対象日。日付が変われば問いかけを出し直す
  const [yesterdayLaterFor, setYesterdayLaterFor] = useState<string | null>(null);

  if (isNotFound(goalQuery.error) || isNotFound(todayQuery.error)) return <NotFound />;
  // ログインが切れたら、キャッシュに残る前の表示（タイトル・昨日の案内・記録の帯）を出さず、画面全体をログイン切れにする
  if ([goalQuery.error, todayQuery.error, logsQuery.error].some(isUnauthenticated)) return <SignedOutPage />;

  const goal = snapshot?.goal;
  const today = snapshot?.today;
  const unit = goal ? unitLabel(goal.unit) : '';
  // 記録の2択を出すか：今日が未記録で、まだ達成していないとき（API の値だけで決める）。記録済みでも選び直し中なら出す
  const unrecorded = today ? today.prediction.todayStatus === 'UNRECORDED' && !today.prediction.progress.completed : false;
  const showChoices = Boolean(today && goal) && (unrecorded || (changing && today?.todayLog != null));
  // 保存は成功したが、Today・記録の取り直しに失敗している（「保存できなかった」と区別して伝える）
  const savedButStale = (todaySaver.refreshFailed || yesterdaySaver.refreshFailed) && (todayQuery.isError || logsQuery.isError);

  let yesterdayArea = null;
  if (goal && today) {
    const common = { sessionAmount: goal.sessionAmount, unit, saver: yesterdaySaver, onRefresh: refresh };
    if (yesterdayEdit) {
      yesterdayArea = (
        <YesterdayCorrection
          // 訂正を始めるたびに作り直し、選択の初期値を保存済みの記録から取り直す
          key="edit"
          {...common}
          log={yesterdayEdit}
          currentYesterday={today.yesterday}
          editing
          disabled={false}
          onStart={() => {}}
          onEnd={() => setYesterdayEdit(null)}
        />
      );
    } else if (showYesterdayPrompt(today, yesterdayLaterFor)) {
      yesterdayArea = <YesterdayPrompt {...common} yesterday={today.yesterday} onLater={() => setYesterdayLaterFor(today.yesterday)} />;
    } else if (snapshot) {
      const record = yesterdayRecord(today.yesterday, goal.recordStartDate, snapshot.logs);
      if (record.kind === 'recorded') {
        yesterdayArea = (
          <YesterdayCorrection
            key="view"
            {...common}
            log={record.log}
            currentYesterday={today.yesterday}
            editing={false}
            disabled={changing || todaySaver.isSaving}
            onStart={() => {
              yesterdaySaver.reset();
              setYesterdayEdit(record.log);
            }}
            onEnd={() => setYesterdayEdit(null)}
          />
        );
      }
    }
  }

  return (
    <div className="fr fr-page">
      <AppBar
        title={goal?.title ?? ''}
        leading={
          <Link to="/goals" className="fr-icon-btn" aria-label="Goal一覧へ戻る">
            <Icon name="back" />
          </Link>
        }
        trailing={
          goal ? (
            <Link to="/goals/$goalId/edit" params={{ goalId }} className="fr-icon-btn" aria-label={`「${goal.title}」を編集`}>
              <Icon name="edit" />
            </Link>
          ) : undefined
        }
      />
      {yesterdayArea}

      {todayQuery.isError || goalQuery.isError || logsQuery.isError ? (
        savedButStale ? (
          <SavedButStale onRetry={refresh} />
        ) : (
          <FetchError error={todayQuery.error ?? goalQuery.error ?? logsQuery.error} onRetry={refresh} />
        )
      ) : resyncFailed ? (
        <Inconsistent onRetry={retryResync} />
      ) : snapshot ? (
        <ForecastBoundary key={todayQuery.dataUpdatedAt}>
          <TodayContent goal={snapshot.goal} today={snapshot.today} logs={snapshot.logs} onChange={() => (yesterdayEdit ? undefined : setChanging(true))} />
        </ForecastBoundary>
      ) : (
        <Loading />
      )}

      {showChoices && today && goal ? (
        <RecordChoiceBar
          // 選び直しを始めたとき・やめたときに、量の入力などを持ち越さない
          key={changing ? 'change' : 'new'}
          today={today.today}
          sessionAmount={goal.sessionAmount}
          unit={unit}
          current={changing ? today.todayLog : null}
          saver={todaySaver}
          locked={yesterdayEdit !== null}
          onCancelChange={() => {
            todaySaver.reset();
            setChanging(false);
          }}
          onRefresh={refresh}
        />
      ) : null}
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

/** ログイン切れ（401）の画面全体。 */
function SignedOutPage() {
  return (
    <div className="fr fr-page">
      <AppBar
        title=""
        leading={
          <Link to="/goals" className="fr-icon-btn" aria-label="Goal一覧へ戻る">
            <Icon name="back" />
          </Link>
        }
      />
      <SignedOut />
    </div>
  );
}

/** 取り直しても Goal・Today・記録の時点がそろわなかった。食い違った組み合わせは表示しない。 */
function Inconsistent({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="fr-today__top">
      <h1 className="fr-today__question">{todayCopy.question}</h1>
      <ErrorPanel
        title={todayCopy.inconsistentTitle}
        action={
          <Button icon="retry" onClick={onRetry}>
            {todayCopy.reload}
          </Button>
        }
      >
        {todayCopy.inconsistent}
      </ErrorPanel>
    </div>
  );
}

/** 保存は成功したが、見通しの取り直しに失敗した。保存できなかったと誤解させない。 */
function SavedButStale({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="fr-today__top">
      <ErrorPanel
        title={todayCopy.savedButStaleTitle}
        action={
          <Button icon="retry" onClick={onRetry}>
            {todayCopy.reload}
          </Button>
        }
      >
        {todayCopy.savedButStale}
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
            <Link to="/goals" className="fr-btn fr-btn--secondary">
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
