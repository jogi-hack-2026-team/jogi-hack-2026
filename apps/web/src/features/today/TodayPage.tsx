import { useQueryClient } from '@tanstack/react-query';
import { goalKeys } from '../../api/goals-http.ts';
import { todayKeys } from '../../api/today-http.ts';
import { Link, useLocation } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import type { GoalR11 as Goal, Log, TodayR11 as Today } from '@contracts';
import { ApiError } from '../../api/client.ts';
import { isNotFound, isUnauthenticated } from '../../api/http.ts';
import { usePrivateEpoch } from '../../api/session-cache.ts';
import { AppBar } from '../../ui/components/AppBar.tsx';
import { PageTitle } from '../../ui/components/PageTitle.tsx';
import { Button } from '../../ui/components/Button.tsx';
import { ErrorPanel, InsufficientNotice } from '../../ui/components/Notice.tsx';
import { Icon } from '../../ui/components/Icon.tsx';
import { Spinner } from '../../ui/components/Spinner.tsx';
import { todayCopy, unitLabel } from '../../copy/today.ts';
import { assertForecastPresentation } from '../prior/PriorForecast.tsx';
import { RecordChoiceBar } from '../logs/RecordChoiceBar.tsx';
import { YesterdayPrompt } from '../logs/YesterdayPrompt.tsx';
import { CoreMetric } from './CoreMetric.tsx';
import { GoalMenu } from './GoalMenu.tsx';
import { RecentDays } from '../history/RecentDays.tsx';
import { ForecastBoundary } from './ForecastBoundary.tsx';
import { OutlookPanel } from './OutlookPanel.tsx';
import { ProgressSummary } from './ProgressSummary.tsx';
import { AchievedFacts, AchievedPanel, ChangeHeader, RecordedSummary, TodayRecordLine } from './RecordedSummary.tsx';
import { useTodayData } from './useTodayData.ts';
import { toForecastView } from './forecast-view.ts';
import { useSaveLog } from '../logs/useSaveLog.ts';
import { showYesterdayPrompt } from './yesterday-later.ts';
import { YesterdayCorrection } from '../logs/YesterdayCorrection.tsx';
import { editLocks, isCurrentToday, reachedDate, yesterdayRecord } from '../logs/record-log.ts';
import '../../ui/tokens.css';
import '../../ui/page.css';
import './today.css';

/**
 * Today Decision 画面（R-05〜R-08）。/goals/$goalId
 * 同じルートで goalId だけが変わると部品が使い回されるため、Goal ごとに作り直して
 * 「後で答える」や記録の変更中の状態を別の Goal へ持ち越さない。
 * ログインしている人が変わったときも作り直し、前の人の表示（最後にそろっていた snapshot など）を捨てる。
 */
export function TodayPage({ goalId }: { goalId: string }) {
  const { owner, clearedAt } = usePrivateEpoch();
  return <TodayScreen key={`${owner ?? ''}:${goalId}`} goalId={goalId} notBefore={clearedAt} />;
}

function TodayScreen({ goalId, notBefore }: { goalId: string; notBefore: number }) {
  // Goal・Today・記録は同じ時点の材料がそろったものだけを使う（snapshot）。日付の切り替わりでも取り直す
  const { goalQuery, todayQuery, logsQuery, snapshot, resyncFailed, refresh, retryResync } = useTodayData(goalId, notBefore);
  // 今日の記録（#79）と昨日の補完・訂正（#80）。保存の状態は別々に持つ
  // 記録済みの今日を選び直している（D5-change）。保存に成功したら戻す
  const [changing, setChanging] = useState(false);
  // 今日の量の入力を開いている。開いている間は昨日の訂正を始めない（今日と昨日を同時に編集しない、#88）
  const [amountEditing, setAmountEditing] = useState(false);
  // 開いた量の入力・記録変更は開始した日を保持する。翌日の入力へ黙って付け替えない
  const [todayEditDate, setTodayEditDate] = useState<string | undefined>();
  const queryClient = useQueryClient();
  // 記録済みの昨日を訂正している。訂正を始めた時点の記録（対象日）を固定して持つ。今日と同時には編集しない
  const [yesterdayEdit, setYesterdayEdit] = useState<Log | null>(null);
  // 保存中の状態は Goal・日付ごとに見る（画面を作り直しても、同じ日の保存が残っていれば保存中のまま）
  // 今日の記録を保存したとき・選び直しをやめたときは、押したボタンが消えるので、記録済み（または達成済み）の見出しへ
  // フォーカスを移す（キーボード・読み上げで場所を見失わない）
  const focusAfterSave = useRef(false);
  const todaySaver = useSaveLog(goalId, {
    onSaved: () => {
      focusAfterSave.current = true;
      setChanging(false);
      setAmountEditing(false);
      setTodayEditDate(undefined);
    },
    localDate: todayEditDate ?? snapshot?.today.today ?? goalQuery.data?.today,
    // 再描画前のクリックでも、QueryClient に到着済みの API 日付を検査する
    canSaveDate: (date) => isCurrentToday(date,
      queryClient.getQueryData<Goal>(goalKeys.detail(goalId))?.today,
      queryClient.getQueryData<Today>(todayKeys.today(goalId))?.today),
  });
  const yesterdaySaver = useSaveLog(goalId, { onSaved: () => setYesterdayEdit(null), localDate: yesterdayEdit?.localDate ?? snapshot?.today.yesterday });
  // 「後で答える」を押したときの対象日。日付が変われば問いかけを出し直す
  const [yesterdayLaterFor, setYesterdayLaterFor] = useState<string | null>(null);

  // 取り直した見出しが出たら、そこへフォーカスを移す（保存の直後だけ）
  useEffect(() => {
    if (!focusAfterSave.current) return;
    const heading = document.getElementById('fr-recorded-title') ?? document.getElementById('fr-achieved-title');
    if (!heading) return;
    focusAfterSave.current = false;
    heading.focus();
  });

  if (isNotFound(goalQuery.error) || isNotFound(todayQuery.error)) return <NotFound />;
  // ログインが切れたら、キャッシュに残る前の表示（タイトル・昨日の案内・記録の帯）を出さず、画面全体をログイン切れにする
  if ([goalQuery.error, todayQuery.error, logsQuery.error].some(isUnauthenticated)) return <SignedOutPage />;

  const goal = snapshot?.goal;
  const today = snapshot?.today;
  const unit = goal ? unitLabel(goal.unit) : '';
  // 記録の2択を出すか：今日が未記録で、まだ達成していないとき（API の値だけで決める）。記録済みでも選び直し中なら出す
  const unrecorded = today ? today.prediction.todayStatus === 'UNRECORDED' && !today.prediction.progress.completed : false;
  // 予測（/today）の取得だけが失敗したときも、取得できた Goal の今日・今日の状態で、今日の記録を付けられるようにする
  // （401・404は上で画面全体を切り替えているので、ここに来るのは計算・通信・サーバーの失敗）
  const fallbackGoal = !today && todayQuery.isError ? goalQuery.data : undefined;
  const recordGoal = goal ?? fallbackGoal;
  const recordDate = todayEditDate ?? today?.today ?? fallbackGoal?.today;
  const canRecordToday = recordDate !== undefined && todaySaver.canSaveDate(recordDate)
    && (!todaySaver.failure?.vars || todaySaver.canSaveDate(todaySaver.failure.vars.localDate));
  const showChoices = today && goal ? unrecorded || (changing && today.todayLog != null) : fallbackGoal?.todayStatus === 'UNRECORDED';
  // 今日と昨日を同時に編集しない（#88）
  const locks = editLocks({
    changingToday: changing,
    todayAmountEditing: amountEditing,
    todayChoicesShown: !!showChoices,
    todaySaving: todaySaver.isSaving,
    yesterdayEditing: yesterdayEdit !== null,
  });
  // 保存は成功したが、Today・記録の取り直しに失敗している（「保存できなかった」と区別して伝える）
  const savedButStale = (todaySaver.refreshFailed || yesterdaySaver.refreshFailed) && (todayQuery.isError || logsQuery.isError);

  // 記録済みの昨日（訂正の対象）。昨日の行と、Goalのメニューの「昨日の記録を訂正」（デザイン P3）の両方から始められる
  const yesterday = goal && today && snapshot ? yesterdayRecord(today.yesterday, goal.recordStartDate, snapshot.logs) : null;
  const startYesterdayCorrection =
    yesterday?.kind === 'recorded' && !yesterdayEdit && !locks.yesterdayLocked
      ? () => {
          yesterdaySaver.reset();
          setYesterdayEdit(yesterday.log);
        }
      : undefined;

  // 記録済みの今日を選び直す（「記録を変更」と直近7日の帯の今日から）
  const startTodayChange = () => {
    if (yesterdayEdit) return;
    setAmountEditing(false);
    setChanging(true);
    setTodayEditDate(today?.today);
  };

  // 今日の記録の選び直しをやめる（上部の「変更をやめる」、デザイン D5-change）
  const cancelChange = () => {
    focusAfterSave.current = true;
    todaySaver.reset();
    setChanging(false);
    setAmountEditing(false);
    setTodayEditDate(undefined);
  };

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
    } else if (yesterday?.kind === 'recorded') {
      const log = yesterday.log;
      yesterdayArea = (
        <YesterdayCorrection
          key="view"
          {...common}
          log={log}
          currentYesterday={today.yesterday}
          editing={false}
          disabled={locks.yesterdayLocked}
          onStart={() => {
            yesterdaySaver.reset();
            setYesterdayEdit(log);
          }}
          onEnd={() => setYesterdayEdit(null)}
        />
      );
    } else if (yesterday?.kind === 'before-start' && today.today === goal.recordStartDate) {
      // 今日から記録を始めたGoal：昨日の問いかけ・訂正の代わりに、開始日前の扱いを伝える（デザイン E4、P-14 の画面文言）
      yesterdayArea = (
        <div className="fr-first-day">
          <InsufficientNotice role="status">{todayCopy.firstDayNote}</InsufficientNotice>
        </div>
      );
    }
  }

  return (
    <div className="fr fr-page fr-page--today">
      <PageTitle title={recordGoal?.title} />
      <AppBar
        title={recordGoal?.title ?? ''}
        leading={
          <Link to="/goals" className="fr-icon-btn" aria-label="Goal一覧へ戻る">
            <Icon name="back" />
          </Link>
        }
        trailing={goal ? <GoalMenu goalId={goalId} onCorrectYesterday={startYesterdayCorrection} /> : undefined}
      />
      {/* デスクトップ幅では上のバーの代わりに「Goal一覧 / Goal名」とメニューを出す（デザイン Desk-today） */}
      <nav className="fr-today__desknav" aria-label={todayCopy.breadcrumb}>
        <Link to="/goals" className="fr-btn fr-btn--text fr-today__crumb">
          <Icon name="back" size={18} />
          {todayCopy.breadcrumbTrail(recordGoal?.title ?? '')}
        </Link>
        {goal ? <GoalMenu goalId={goalId} onCorrectYesterday={startYesterdayCorrection} /> : null}
      </nav>
      {/* スマートフォン幅では中身をそのまま縦に並べ、デスクトップ幅では左右2列にする（today.css） */}
      <div className="fr-today-layout">
      {/* 直近7日の帯（デザイン P1）。押せるのは記録を変えられる今日と昨日だけ */}
      {goal && today && snapshot ? (
        <RecentDays
          today={today.today}
          yesterday={today.yesterday}
          recordStartDate={goal.recordStartDate}
          logs={snapshot.logs}
          onYesterday={startYesterdayCorrection}
          onToday={today.todayLog && !changing && !yesterdayEdit ? startTodayChange : undefined}
        />
      ) : null}
      {yesterdayArea}

      {todayQuery.isError || goalQuery.isError || logsQuery.isError ? (
        savedButStale ? (
          <SavedButStale onRetry={refresh} />
        ) : (
          <FetchError error={todayQuery.error ?? goalQuery.error ?? logsQuery.error} onRetry={refresh} canRecordToday={canRecordToday} />
        )
      ) : resyncFailed ? (
        <Inconsistent onRetry={retryResync} />
      ) : snapshot ? (
        <ForecastBoundary resetKey={todayQuery.dataUpdatedAt}>
          <TodayContent
            goal={snapshot.goal}
            today={snapshot.today}
            logs={snapshot.logs}
            changing={changing}
            onCancelChange={cancelChange}
            onChange={startTodayChange}
          />
        </ForecastBoundary>
      ) : (
        <Loading />
      )}

      {showChoices && recordGoal && recordDate ? (
        <RecordChoiceBar
          // 選び直しを始めたとき・やめたときに、量の入力などを持ち越さない
          key={changing ? 'change' : 'new'}
          today={recordDate}
          sessionAmount={recordGoal.sessionAmount}
          unit={unitLabel(recordGoal.unit)}
          current={changing && today ? today.todayLog : null}
          saver={todaySaver}
          locked={locks.todayLocked}
          editingAmount={locks.todayAmountEditing}
          onEditingAmountChange={(editing) => {
            setAmountEditing(editing);
            setTodayEditDate(editing || changing ? recordDate : undefined);
          }}
          onRefresh={() => {
            todaySaver.reset();
            setChanging(false);
            setAmountEditing(false);
            setTodayEditDate(undefined);
            refresh();
          }}
        />
      ) : null}
      </div>
    </div>
  );
}

function TodayContent({
  goal,
  today,
  logs,
  changing,
  onChange,
  onCancelChange,
}: {
  goal: Goal;
  today: Today;
  logs: Log[];
  /** 今日の記録を選び直している（上部を「今日の記録を変更」に切り替える、デザイン D5-change）。 */
  changing: boolean;
  onChange: () => void;
  onCancelChange: () => void;
}) {
  // 変換と検査は Boundary の内側で行う（失敗しても記録の2択は残る）
  // R-11 の出所（provenance）と、材料が足りないときの計画（plan）は API の値をそのまま渡す
  const view = toForecastView(today.prediction, goal.unit, { provenance: today.provenance, plan: today.plan, sessionAmount: today.context.sessionAmount });
  assertForecastPresentation(view);
  const unit = unitLabel(goal.unit);
  const progress =
    view.kind === 'completed' || view.kind === 'forecast' || view.kind === 'today-recorded' ? (
      <ProgressSummary progress={view.progress} initialProgress={goal.initialProgress} logs={logs} recordStartDate={goal.recordStartDate} today={today.today} />
    ) : null;
  const outlookTitle = todayCopy.outlookTitle(goal.totalRequired, unit);
  const changeHeader =
    changing && today.todayLog ? <ChangeHeader log={today.todayLog} sessionAmount={goal.sessionAmount} unit={unit} onCancel={onCancelChange} /> : null;

  switch (view.kind) {
    case 'completed':
      return (
        <>
          {changeHeader ?? <AchievedPanel done={view.progress.done} total={view.progress.total} unit={unit} />}
          {/* 達成済みでも、今日の記録の誤りを直せるようにする（R-03の当日の変更と R-08 の達成表示の両立） */}
          {today.todayLog && !changeHeader ? (
            <TodayRecordLine log={today.todayLog} today={today.today} sessionAmount={goal.sessionAmount} unit={unit} onChange={onChange} />
          ) : null}
          {progress}
          <AchievedFacts goalId={goal.id} recordStartDate={goal.recordStartDate} reached={reachedDate(goal.initialProgress, goal.totalRequired, logs)} />
        </>
      );
    case 'today-recorded':
      return (
        <>
          {changeHeader ?? (today.todayLog ? <RecordedSummary todayLog={today.todayLog} unit={unit} onChange={onChange} /> : null)}
          <div className="fr-today__right">
            <OutlookPanel completion={view.completion} today={today.today} title={outlookTitle} />
            {progress}
          </div>
        </>
      );
    case 'forecast':
      return (
        <>
          <section className="fr-today__top" aria-labelledby="fr-question">
            <h1 id="fr-question" className="fr-today__question">
              {todayCopy.question}
            </h1>
            <CoreMetric core={view.core} />
            {view.core.kind === 'insufficient' && !hasAnswers(goal) ? (
              // まだ質問に答えていなければ、答えて最初の見通しを出せることを伝える（R-11、デザインキャンバス R4）
              <Link to="/goals/$goalId/edit" params={{ goalId: goal.id }} className="fr-link">
                {todayCopy.answerQuestions}
              </Link>
            ) : null}
          </section>
          <div className="fr-today__right">
            <OutlookPanel completion={view.completion} today={today.today} title={outlookTitle} />
            {progress}
          </div>
        </>
      );
    default:
      // loading・error など取得側の状態は、この部品に渡さない（親で扱う）
      throw new TypeError(`Today の表示データとして想定していない状態です: ${view.kind}`);
  }
}

/** R-11 の回答が1つでもあるか（Goal は ?view=r11 で読むので questionPrior を持つ）。 */
function hasAnswers(goal: Goal & { questionPrior?: { a: unknown; b: unknown } }): boolean {
  return goal.questionPrior !== undefined && (goal.questionPrior.a !== null || goal.questionPrior.b !== null);
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

function FetchError({ error, onRetry, canRecordToday }: { error: unknown; onRetry: () => void; canRecordToday: boolean }) {
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
        {calc ? (canRecordToday ? todayCopy.calcError : todayCopy.calcErrorRecordBlocked) : todayCopy.networkError}
      </ErrorPanel>
    </div>
  );
}

/** ログイン切れ（401）の画面全体。 */
function SignedOutPage() {
  return (
    <div className="fr fr-page">
      <PageTitle title={todayCopy.signedOutTitle} />
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
      <PageTitle title={todayCopy.notFoundTitle} />
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
          <Link to="/login" search={{ redirect: location.href, reason: 'expired' }} className="fr-btn fr-btn--secondary">
            {todayCopy.signIn}
          </Link>
        }
      >
        {todayCopy.signedOut}
      </ErrorPanel>
    </div>
  );
}
