import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { Goal } from '@contracts';
import { authClient } from '../../auth/client.ts';
import { clearCreateAttempt, loadCreateAttempt, prepareCreateAttempt, CreateRecoveryError, createFailureKind, type CreateAttempt } from './create-attempt.ts';
import { ApiError } from '../../api/client.ts';
import { goalKeys, goalsHttp } from '../../api/goals-http.ts';
import { isNotFound, isUnauthenticated } from '../../api/http.ts';
import { usePrivateEpoch } from '../../api/session-cache.ts';
import { goalsCopy } from '../../copy/goals.ts';
import { longDate } from '../../copy/date.ts';
import { todayCopy, unitLabel } from '../../copy/today.ts';
import { AppBar } from '../../ui/components/AppBar.tsx';
import { DeskHeader } from '../../ui/components/DeskHeader.tsx';
import { PageTitle } from '../../ui/components/PageTitle.tsx';
import { Button } from '../../ui/components/Button.tsx';
import { ConfirmDialog } from '../../ui/components/ConfirmDialog.tsx';
import { Field, fieldAria, NumberInput, SegmentedControl, SelectInput, TextInput } from '../../ui/components/FormField.tsx';
import { Icon } from '../../ui/components/Icon.tsx';
import { ErrorPanel } from '../../ui/components/Notice.tsx';
import { Spinner } from '../../ui/components/Spinner.tsx';
import { StickyActionBar } from '../../ui/components/StickyActionBar.tsx';
import { fetchPolicy } from '../today/fetch-policy.ts';
import { QuestionPriorFields } from '../prior/QuestionPriorFields.tsx';
import '../prior/question-prior.css';
import {
  answersLockReason,
  emptyValues,
  errorCount,
  FIELD_ORDER,
  fieldErrorsFromApi,
  rebaseValues,
  reloadLatestGoal,
  TITLE_MAX,
  titleLength,
  toCreateBody,
  toPatchBody,
  validate,
  valuesFromGoal,
  type FieldErrors,
  type FieldName,
  type GoalWithAnswers,
  NO_ANSWERS,
  type FormValues,
} from './goal-form.ts';
import { GoalNotFoundPanel, LoadErrorPanel, SignedOutPanel } from './GoalStates.tsx';
import '../../ui/tokens.css';
import '../../ui/page.css';
import './goals.css';

const c = goalsCopy;
const f = goalsCopy.form;
const browserTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Goal の作成（R-02、#78）。/goals/new */
export function GoalCreatePage() {
  // ログインしている人が替わったら作り直し、前の人の入力を持ち越さない
  const session = authClient.useSession();
  const owner = session.data?.user.id;
  if (session.isPending) return <FormShell title={f.createTitle} body={<FormLoading />} />;
  if (!owner) return <SignedOutPanel body={c.signedOut.formBody} />;
  return <GoalForm key={owner} mode="create" owner={owner} />;
}

/** Goal の編集・削除（R-02、#78）。/goals/$goalId/edit。Goal を読み込んでからフォームを出す。 */
export function GoalEditPage({ goalId }: { goalId: string }) {
  const { owner } = usePrivateEpoch();
  const query = useQuery({ queryKey: goalKeys.detail(goalId), queryFn: ({ signal }) => goalsHttp.getGoal(goalId, signal), ...fetchPolicy });
  if (!query.data) {
    if (!query.isError) return <FormShell title={f.editTitle} body={<FormLoading />} />;
    // 最初の読み込みの失敗。入力はまだないので、フォームの代わりにエラーを出す
    return (
      <FormShell
        title={isNotFound(query.error) ? c.notFound.heading : f.editTitle}
        body={isNotFound(query.error) ? <GoalNotFoundPanel /> : <LoadErrorPanel error={query.error} onRetry={() => void query.refetch()} />}
      />
    );
  }
  // 別の Goal を開き直したとき・ログインしている人が替わったときは、入力中の値と編集開始時の値（baseline）を持ち越さない。
  // 表示した後の再取得（focus・reconnect）の失敗では、フォームを残したまま知らせる（未保存の入力を消さない）
  return (
    <GoalForm
      key={`${owner ?? ''}:${goalId}`}
      mode="edit"
      goal={query.data}
      refreshError={query.isError ? query.error : null}
      onRetryRefresh={() => void query.refetch()}
      onReloadLatest={() => reloadLatestGoal(() => query.refetch())}
    />
  );
}

function FormShell({ title, body }: { title: string; body: ReactNode }) {
  return (
    <div className="fr fr-page fr-page--desk">
      <PageTitle title={title} />
      <AppBar title={title} leading={<CloseLink />} />
      <DeskHeader back={<ListCrumb />} title={title} />
      <div className="fr-goals__pad">{body}</div>
    </div>
  );
}

function CloseLink() {
  return (
    <Link to="/goals" className="fr-icon-btn" aria-label={f.close}>
      <Icon name="close" />
    </Link>
  );
}

/** デスクトップ幅の戻り先（Goal一覧）。 */
function ListCrumb() {
  return (
    <Link to="/goals" className="fr-btn fr-btn--text">
      <Icon name="back" size={18} />
      {c.crumbList}
    </Link>
  );
}

/** デスクトップ幅の編集の戻り先（そのGoalのToday。表示は Today の戻り先と同じ「Goal一覧 / タイトル」）。 */
function GoalCrumb({ goal }: { goal: Goal }) {
  return (
    <Link to="/goals/$goalId" params={{ goalId: goal.id }} className="fr-btn fr-btn--text">
      <Icon name="back" size={18} />
      {todayCopy.breadcrumbTrail(goal.title)}
    </Link>
  );
}

function FormLoading() {
  return (
    <p className="fr-goals__help fr-goals__loading" role="status">
      <Spinner />
      {c.loadingVisible}
    </p>
  );
}

type Props =
  | { mode: 'create'; owner: string; goal?: undefined; refreshError?: undefined; onRetryRefresh?: undefined; onReloadLatest?: undefined }
  | {
      mode: 'edit';
      owner?: undefined;
      goal: GoalWithAnswers;
      refreshError: unknown;
      onRetryRefresh: () => void;
      /** 最新の Goal（回答と回答の版を含む）を読み直す。古い版で保存できなかったとき（409）に使う。 */
      onReloadLatest: () => Promise<GoalWithAnswers | undefined>;
    };

function GoalForm({ mode, owner, goal, refreshError, onRetryRefresh, onReloadLatest }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const locked = mode === 'edit' && goal.hasLogs;
  // 回復情報は過去の送信結果が不明な証跡。壊れたJSON・旧schemaでも画面を落とさず、原文は保全する。
  const [recovery] = useState(() => {
    try { return { attempt: owner ? loadCreateAttempt(owner, sessionStorage) : null, error: null }; }
    catch (error) { return { attempt: null, error: error instanceof CreateRecoveryError ? error : new CreateRecoveryError() }; }
  });
  const [prepareError, setPrepareError] = useState<unknown>(recovery.error);
  const [attempt, setAttempt] = useState<CreateAttempt | null>(recovery.attempt);
  const recoveryValues = attempt ? { ...emptyValues(attempt.body.timezone), ...attempt.body,
    totalRequired: String(attempt.body.totalRequired), sessionAmount: String(attempt.body.sessionAmount),
    initialProgress: String(attempt.body.initialProgress ?? 0), questionPrior: attempt.body.questionPrior ?? NO_ANSWERS } : null;
  const [values, setValues] = useState<FormValues>(() => (goal ? valuesFromGoal(goal) : recoveryValues ?? emptyValues(browserTimezone())));
  // 保存を押すまでは項目のエラーを出さない。押した後は入力のたびに検査し直す
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  const [deleteOpen, setDeleteOpen] = useState(false);
  // APIの422で見つかったエラー項目。送信中は入力欄が押せないため、送信が終わってからフォーカスを移す
  const [focusAfterSave, setFocusAfterSave] = useState<FieldErrors | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  // 送信中かどうか。状態（isPending）は再描画まで切り替わらず、素早い2回目のクリックを止められないため、即座に変わる目印も持つ。
  // 成功したら一覧へ移るまで立てたままにし、失敗したときだけ下ろす
  const saving = useRef(false);
  const deleting = useRef(false);
  // 編集を始めた時点の Goal。変えた項目だけを送るための比較元で、再取得で goal が新しくなっても変えない
  // （変えると、別のタブでの変更を、触っていない項目まで古い値で巻き戻してしまう）
  // 古い版で保存できなかったとき（409）に、利用者が最新を読み直したら、その Goal を新しい比較元にする（入力は残す）
  const [baseline, setBaseline] = useState(goal);
  // 最新を読み直したときの回答。入力中の回答で上書きする前に確かめられるよう、知らせとして出す
  const [latestAnswers, setLatestAnswers] = useState<GoalWithAnswers['questionPrior'] | null>(null);
  // 初期質問の開閉。保存済みの回答がある編集では開いた状態から始める
  const [priorOpen, setPriorOpen] = useState(() => values.questionPrior.a !== null || values.questionPrior.b !== null);
  const [reloadingLatest, setReloadingLatest] = useState(false);
  const reloadInFlight = useRef(false);
  // この画面がまだ表示されているか。保存の途中で離れた後に、別の画面を一覧へ移さないために使う
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const clientErrors = submitted ? validate(values, { locked, ...(mode === 'edit' ? { goal } : {}) }) : {};
  const errors: FieldErrors = { ...serverErrors, ...clientErrors };
  const count = errorCount(errors);

  const finishCreateAttempt = (operation: CreateAttempt): boolean => {
    // 離脱後に別フォームが同じ操作を復元・再送している可能性がある。
    // 旧応答ではstorageを終了せず、表示中のフォームの確定応答へ引き継ぐ。
    if (!mounted.current) return false;
    try {
      if (!clearCreateAttempt(operation, sessionStorage)) return false;
      setAttempt(current => current?.owner === operation.owner && current.key === operation.key && current.raw === operation.raw ? null : current);
      return true;
    } catch (error) {
      // 保存情報を消せなければ回復情報を保持する。422のfield error処理は続ける。
      setPrepareError(error);
      return false;
    }
  };

  const save = useMutation({
    retry: false,
    mutationFn: async ({ values: v, operation }: { values: FormValues; operation: CreateAttempt | null }): Promise<Goal | null> => {
      if (mode === 'create') {
        if (!operation || operation.owner !== owner) throw new Error('作成操作を確認できません。');
        // 描画後に別タブでcookieが変わった場合、POST前に止めて元の操作を保持する。
        // このGETの後の切替はAPIのX-Create-Owner検証で拒否する。取得失敗でも新しいキーは作らない。
        const current = await authClient.getSession({ query: { disableCookieCache: true } });
        if (current.error) throw new Error('アカウントを確認できません。作成操作は保持しています。');
        if (current.data?.user.id !== operation.owner) throw new ApiError(409, { error: { code: 'CREATE_OWNER_CHANGED', message: '作成時のアカウントでログインし直してから再試行してください。' } });
        return goalsHttp.createGoal(operation.body, operation.key, operation.owner);
      }
      // 記録の有無は最新の Goal に従う（記録が付いた後は timezone・initialProgress を送らない）
      const patch = toPatchBody(v, { ...baseline!, hasLogs: goal.hasLogs });
      return patch ? goalsHttp.updateGoal(goal.id, patch) : null;
    },
    // 一覧などの取り直しは、画面を離れていても必ず行う。一覧への移動は mutate に渡す onSuccess で、表示中のときだけ行う
    onSuccess: async (_goal, vars) => {
      if (vars.operation) finishCreateAttempt(vars.operation);
      await queryClient.invalidateQueries({ queryKey: goalKeys.all });
    },
    onError: (error, vars) => {
      saving.current = false;
      if (vars.operation && error instanceof ApiError && error.status === 422) finishCreateAttempt(vars.operation);
      const fromApi = fieldErrorsFromApi(error);
      if (fromApi && errorCount(fromApi) > 0) {
        setServerErrors(fromApi);
        setFocusAfterSave(fromApi);
      }
    },
  });

  const remove = useMutation({
    mutationFn: () => goalsHttp.deleteGoal(goal!.id),
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: goalKeys.detail(goal!.id) });
      await queryClient.invalidateQueries({ queryKey: goalKeys.all });
    },
    onError: async (error) => {
      deleting.current = false;
      // すでに削除されていた（別のタブなど）場合も、一覧を取り直す
      if (isNotFound(error)) await queryClient.invalidateQueries({ queryKey: goalKeys.all });
    },
  });

  // 保存・削除が終わったとき、この画面がまだ表示されていれば一覧へ戻る（離れた後なら、いま表示中の別の画面を動かさない）
  const leaveToList = () => {
    if (!mounted.current) return;
    setDeleteOpen(false);
    void navigate({ to: '/goals' });
  };

  const update = <K extends FieldName>(name: K, value: FormValues[K]) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    if (serverErrors[name]) setServerErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    // 送信中は二重に送らない（ボタンも押せなくしている）
    if (saving.current || reloadInFlight.current || prepareError instanceof CreateRecoveryError ||
      (save.isError && (isEditConflict(save.error) || ['conflict', 'deleted'].includes(createFailureKind(save.error) ?? '')))) return;
    setSubmitted(true);
    setServerErrors({});
    const found = validate(values, { locked, ...(mode === 'edit' ? { goal } : {}) });
    if (errorCount(found) > 0) {
      focusFirstError(found);
      return;
    }
    setPrepareError(null);
    try {
      // 再表示で復元した操作を優先する。旧画面の遅延成功がstorageを消しても、
      // 保持中の操作を新しいキーへ切り替えず同じキー・元bodyで結果を確認する。
      const operation = mode === 'create' ? attempt ?? prepareCreateAttempt(owner!, toCreateBody(values), sessionStorage) : null;
      if (operation) setAttempt(operation);
      saving.current = true;
      save.mutate({ values, operation }, { onSuccess: leaveToList });
    } catch (error) { saving.current = false; setPrepareError(error); }
  };

  const focusFirstError = (found: FieldErrors) => {
    const first = FIELD_ORDER.find((name) => found[name]);
    if (!first) return;
    const selector = first === 'unit' ? '[aria-labelledby="goal-unit-label"] button' : first === 'questionPrior' ? '.r11-qp input' : `#goal-${first}`;
    const target = formRef.current?.querySelector<HTMLElement>(selector);
    target?.focus();
  };

  const busy = save.isPending;
  const recoveryBlocked = prepareError instanceof CreateRecoveryError;
  const inputDisabled = busy || (mode === 'create' && (attempt !== null || recoveryBlocked));
  useEffect(() => {
    if (!focusAfterSave || busy) return;
    focusFirstError(focusAfterSave);
    setFocusAfterSave(null);
  }, [focusAfterSave, busy]);
  const unit = unitLabel(values.unit);
  const timezones = useTimezones(values.timezone);
  // 422 で項目に割り当てられたエラーは各項目に出す。それ以外（通信・サーバー・ログイン切れ）は保存ボタンの上に出す
  const apiFieldErrors = save.isError ? fieldErrorsFromApi(save.error) : null;
  const saveFailure = prepareError ?? (save.isError && (apiFieldErrors === null || errorCount(apiFieldErrors) === 0) ? save.error : null);
  const deletedAttempt = mode === 'create' && isCreateResultDeleted(saveFailure) &&
    save.variables?.operation?.owner === owner && save.variables.operation.key === attempt?.key ? attempt : null;
  const showSaveFailure = saveFailure !== null && (count === 0 || prepareError instanceof CreateRecoveryError);
  // 通信・サーバーの失敗は「もう一度保存」。ログイン切れはログインし直すまで同じ文言のままにする
  const canRetry = showSaveFailure && !isUnauthenticated(saveFailure) && !isEditConflict(saveFailure) && createFailureKind(saveFailure) === null;
  const restartCreate = () => {
    if (!deletedAttempt || busy || !mounted.current) return;
    try {
      // 410を確認した同owner/keyだけを終了する。新keyは次の明示保存まで作らない。
      if (!finishCreateAttempt(deletedAttempt)) return;
      setPrepareError(null); setSubmitted(false); save.reset();
    } catch (error) { setPrepareError(error); }
  };
  // 単位か1回の量を変えている間は、回答を一緒に送れない（R-11、#133。保存済みの回答は API が取り消す）。
  // 保存済みの回答の有無にかかわらず回答の欄は押せなくし、そのことを伝える（入力した回答が黙って保存されないことを防ぐ）
  const answersLock = mode === 'edit' && baseline !== undefined ? answersLockReason(values, baseline) : null;
  const reloadLatest = async () => {
    if (reloadInFlight.current || saving.current) return;
    reloadInFlight.current = true;
    setReloadingLatest(true);
    try {
      const latest = await onReloadLatest?.();
      if (!latest || !mounted.current) return;
      // 成功した取得だけで比較元を更新する。触った項目は残し、触っていない項目は最新にする。
      if (baseline) setValues((current) => rebaseValues(current, baseline, latest));
      setBaseline(latest);
      setLatestAnswers(latest.questionPrior ?? NO_ANSWERS);
      save.reset();
    } finally {
      reloadInFlight.current = false;
      if (mounted.current) setReloadingLatest(false);
    }
  };

  return (
    <div className="fr fr-page fr-page--desk">
      <PageTitle title={mode === 'create' ? f.createTitle : f.editTitle} />
      <AppBar title={mode === 'create' ? f.createTitle : f.editTitle} leading={<CloseLink />} />
      <DeskHeader back={goal ? <GoalCrumb goal={goal} /> : <ListCrumb />} title={mode === 'create' ? f.createTitle : f.editTitle} />
      <form ref={formRef} className={`fr-goalform fr-goalform--${mode}`} noValidate onSubmit={onSubmit} aria-busy={busy || undefined}>
        <div className="fr-goalform__fields">
          {attempt ? <p role="status">{f.createRecovery.pending}</p> : null}
          {refreshError && onRetryRefresh ? <RefreshFailed error={refreshError} onRetry={isEditConflict(save.error) ? () => void reloadLatest() : onRetryRefresh} editConflict={isEditConflict(save.error)} /> : null}
          {count > 0 ? (
            <div className="fr-goalform__summary" role="alert">
              <Icon name="alert" size={20} />
              {f.summary(count)}
            </div>
          ) : null}

          <Field id="goal-title" label={f.title} counter={`${titleLength(values.title)} / ${TITLE_MAX}`} error={errors.title}>
            <TextInput
              id="goal-title"
              value={values.title}
              onChange={(event) => update('title', event.target.value)}
              disabled={inputDisabled}
              invalid={Boolean(errors.title)}
              autoComplete="off"
              {...fieldAria('goal-title', { error: errors.title })}
            />
          </Field>

          <Field id="goal-unit" label={f.unit} group error={errors.unit} help={mode === 'edit' && goal.unitLocked ? (
            <>
              <LockedNote>{goalsCopy.errors.unitLocked}</LockedNote>
              {values.unit !== goal.unit ? <Button variant="secondary" disabled={inputDisabled} onClick={() => update('unit', goal.unit)}>{f.restoreSavedUnit}</Button> : null}
              <Link to="/goals/new">{f.createNewGoal}</Link>
            </>
          ) : undefined}>
            <SegmentedControl
              labelledBy="goal-unit-label"
              options={[
                { value: 'minutes', label: f.units.minutes },
                { value: 'sessions', label: f.units.sessions },
              ]}
              value={values.unit}
              onChange={(value) => update('unit', value)}
              disabled={inputDisabled || (mode === 'edit' && goal.unitLocked)}
            />
          </Field>

          {/* デスクトップ幅では2列に並べる（デザイン Desk-create）。スマートフォン幅では1列のまま */}
          <div className="fr-goalform__pair">
            <AmountField id="goal-totalRequired" label={f.totalRequired} unit={unit} value={values.totalRequired} error={errors.totalRequired} disabled={inputDisabled} onChange={(v) => update('totalRequired', v)} />
            <AmountField id="goal-sessionAmount" label={f.sessionAmount} unit={unit} value={values.sessionAmount} error={errors.sessionAmount} disabled={inputDisabled} onChange={(v) => update('sessionAmount', v)} />
          </div>
          <AmountField
            id="goal-initialProgress"
            label={f.initialProgress}
            unit={unit}
            value={values.initialProgress}
            error={errors.initialProgress}
            disabled={inputDisabled || locked}
            onChange={(v) => update('initialProgress', v)}
            help={
              <>
                <p>{goal ? f.initialProgressHelp(longDate(goal.recordStartDate)) : f.initialProgressHelpNew}</p>
                {locked ? <LockedNote>{f.lockedInitialProgress}</LockedNote> : null}
              </>
            }
          />

          <Field
            id="goal-timezone"
            label={f.timezone}
            error={errors.timezone}
            help={
              <>
                <p>{f.timezoneHelp}</p>
                {locked ? <LockedNote>{f.lockedTimezone}</LockedNote> : null}
              </>
            }
          >
            <SelectInput
              id="goal-timezone"
              value={values.timezone}
              onChange={(event) => update('timezone', event.target.value)}
              disabled={inputDisabled || locked}
              invalid={Boolean(errors.timezone)}
              {...fieldAria('goal-timezone', { help: true, error: errors.timezone })}
            >
              {timezones.map((tz) => (
                <option key={tz} value={tz}>
                  {tz === browserTimezone() ? f.browserTimezone(tz) : tz}
                </option>
              ))}
            </SelectInput>
          </Field>

          {/* 初期質問は任意なので、開閉できる形で閉じて置く（デザイン C1・R1）。回答・エラー・お知らせがあるときは開いておく */}
          <details
            className="fr-goalform__prior"
            open={priorOpen || Boolean(errors.questionPrior) || latestAnswers !== null || answersLock !== null}
            onToggle={(event) => setPriorOpen(event.currentTarget.open)}
          >
            <summary className="fr-goalform__prior-summary">
              <h2 id="fr-goalform-prior-title" className="fr-goalform__prior-title">
                {f.priorTitle}
              </h2>
              <Icon name="chevronDown" size={20} />
            </summary>
            {latestAnswers ? (
              <p className="fr-goalform__latest" role="status">
                {f.latestAnswers(answerLabel(latestAnswers.a), answerLabel(latestAnswers.b))}
              </p>
            ) : null}
            <QuestionPriorFields
              externalHeadingId="fr-goalform-prior-title"
              value={answersLock ? NO_ANSWERS : values.questionPrior}
              onChange={(next) => update('questionPrior', next)}
              disabled={inputDisabled || answersLock !== null}
              fieldErrors={errors.questionPrior ? { a: errors.questionPrior } : {}}
            />
            {answersLock ? <LockedNote>{answersLock === 'withdrawn' ? f.answersWithdrawn : f.answersNotSavedWithContext}</LockedNote> : null}
            <p className="fr-goals__help">{f.answersNotRecords}</p>
          </details>

          {mode === 'edit' ? (
            <div className="fr-goalform__delete-mobile">
              <Button variant="text" icon="trash" disabled={inputDisabled} onClick={() => setDeleteOpen(true)}>
                {f.delete}
              </Button>
            </div>
          ) : null}
        </div>

        <StickyActionBar>
          <div className="fr-goalform__actions">
            {showSaveFailure ? <SaveFailure error={saveFailure} mode={mode} onReloadLatest={reloadLatest} reloadingLatest={reloadingLatest} onRestartCreate={deletedAttempt ? restartCreate : undefined} /> : null}
            {/* デスクトップ幅では、削除を左端に、取りやめ（スマートフォン幅の「×」の代わり）を保存の横に置く（デザイン Desk-edit） */}
            <div className="fr-goalform__buttons">
              {mode === 'edit' ? (
                <span className="fr-goalform__delete-desk">
                  <Button variant="text" icon="trash" disabled={inputDisabled} onClick={() => setDeleteOpen(true)}>
                    {f.delete}
                  </Button>
                </span>
              ) : null}
              {goal ? (
                <Link to="/goals/$goalId" params={{ goalId: goal.id }} className="fr-btn fr-btn--secondary fr-goalform__cancel">
                  {f.cancel}
                </Link>
              ) : (
                <Link to="/goals" className="fr-btn fr-btn--secondary fr-goalform__cancel">
                  {f.cancel}
                </Link>
              )}
              <Button type="submit" variant="primary" block busy={busy} disabled={reloadingLatest || isEditConflict(saveFailure) || recoveryBlocked || ['conflict', 'deleted'].includes(createFailureKind(saveFailure) ?? '')} {...(canRetry ? { icon: 'retry' as const } : {})}>
                {busy ? f.saving : createFailureKind(saveFailure) === 'owner' ? f.createRecovery.ownerRetry : canRetry ? f.saveFailed.retry : mode === 'create' ? f.save : f.saveEdit}
              </Button>
            </div>
          </div>
        </StickyActionBar>
      </form>

      {mode === 'edit' ? (
        <ConfirmDialog
          open={deleteOpen}
          title={c.deleteDialog.title}
          confirmLabel={c.deleteDialog.confirm}
          confirmIcon="trash"
          cancelLabel={c.deleteDialog.cancel}
          busy={remove.isPending}
          onConfirm={() => {
            if (deleting.current) return;
            deleting.current = true;
            remove.mutate(undefined, {
              onSuccess: leaveToList,
              // すでに削除されていた（別のタブなど）場合は、一覧へ戻る
              onError: (error) => {
                if (isNotFound(error)) leaveToList();
              },
            });
          }}
          onCancel={() => {
            setDeleteOpen(false);
            remove.reset();
          }}
        >
          <p>
            {c.deleteDialog.body(goal.title)}
            <b>{c.deleteDialog.bodyStrong}</b>。
          </p>
          <p>{c.deleteDialog.irreversible}</p>
          {remove.isError && !isNotFound(remove.error) ? (
            isUnauthenticated(remove.error) ? (
              <SignedOutPanel body={c.signedOut.body} newTab />
            ) : (
              <p className="fr-goalform__dialog-error" role="alert">
                {c.deleteDialog.failed}
              </p>
            )
          ) : null}
        </ConfirmDialog>
      ) : null}
    </div>
  );
}

/** 表示した後の再取得の失敗。フォームと入力はそのまま残す。 */
function RefreshFailed({ error, onRetry, editConflict }: { error: unknown; onRetry: () => void; editConflict: boolean }) {
  if (isUnauthenticated(error)) return <SignedOutPanel body={c.signedOut.formBody} newTab />;
  return (
    <ErrorPanel
      title={f.refreshFailed.title}
      action={
        <Button icon="retry" onClick={onRetry}>
          {c.loadError.retry}
        </Button>
      }
    >
      {isNotFound(error) ? f.refreshFailed.notFound : editConflict ? f.refreshFailed.conflictBody : f.refreshFailed.body}
    </ErrorPanel>
  );
}

function AmountField({
  id,
  label,
  unit,
  value,
  error,
  disabled,
  onChange,
  help,
}: {
  id: string;
  label: string;
  unit: string;
  value: string;
  error: string | undefined;
  disabled: boolean;
  onChange: (value: string) => void;
  help?: ReactNode;
}) {
  return (
    <Field id={id} label={label} error={error} help={help}>
      <NumberInput id={id} suffix={unit} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} invalid={Boolean(error)} {...fieldAria(id, { help, error })} />
    </Field>
  );
}

function LockedNote({ children }: { children: string }) {
  return (
    <p className="fr-goalform__locked">
      <Icon name="info" size={16} />
      {children}
    </p>
  );
}

/** 保存の失敗。失敗したのに保存済みに見せない（入力は残し、まだ保存されていないことを書く）。 */
function SaveFailure({ error, mode, onReloadLatest, reloadingLatest, onRestartCreate }: { error: unknown; mode: 'create' | 'edit'; onReloadLatest: () => Promise<void>; reloadingLatest: boolean; onRestartCreate?: (() => void) | undefined }) {
  if (isUnauthenticated(error)) return <SignedOutPanel body={c.signedOut.formBody} newTab />;
  if (mode === 'create' && (createFailureKind(error) === 'recovery' || createFailureKind(error) === 'conflict')) return (
    <ErrorPanel
      title={createFailureKind(error) === 'recovery' ? f.createRecovery.unreadableTitle : f.createRecovery.conflictTitle}
      action={<Link to="/goals" className="fr-btn fr-btn--secondary">{f.createRecovery.checkList}</Link>}
    >
      {f.createRecovery.checkBody}
    </ErrorPanel>
  );
  if (mode === 'create' && createFailureKind(error) === 'owner') return (
    <SignedOutPanel body={f.createRecovery.ownerBody} newTab />
  );
  if (mode === 'create' && isCreateResultDeleted(error)) return (
    <ErrorPanel title={f.createRecovery.deletedTitle} action={onRestartCreate ? <Button onClick={onRestartCreate}>{f.createRecovery.restart}</Button> : undefined}>
      {f.createRecovery.deletedBody}
    </ErrorPanel>
  );
  if (isEditConflict(error)) {
    // 回答またはGoal設定の版が古い。保存済みに見せず、入力を残して最新を読み直してもらう。
    return (
      <ErrorPanel
        title={f.answerConflict.title}
        action={
          <Button icon="retry" busy={reloadingLatest} onClick={() => void onReloadLatest()}>
            {f.answerConflict.reload}
          </Button>
        }
      >
        {f.answerConflict.body}
      </ErrorPanel>
    );
  }
  return (
    <ErrorPanel title={f.saveFailed.title}>
      {mode === 'create' ? f.saveFailed.createBody : f.saveFailed.editBody}
    </ErrorPanel>
  );
}

/** 回答またはGoal設定の古い版で保存しようとした409。 */
function isEditConflict(error: unknown): boolean {
  return error instanceof ApiError && error.status === 409 && ['ANSWER_CONFLICT', 'GOAL_SETTINGS_CONFLICT'].includes(error.body?.error.code ?? '');
}
function isCreateResultDeleted(error: unknown): boolean {
  return error instanceof ApiError && error.status === 410 && error.body?.error.code === 'CREATE_RESULT_DELETED';
}

const answerLabel = (answer: NonNullable<GoalWithAnswers['questionPrior']>['a']) => f.answerLabels[answer ?? 'none'];

/** 選べるタイムゾーン。ブラウザが知っている IANA 名に、今の値（ブラウザ設定・保存済みの値）を必ず含める。 */
function useTimezones(current: string): string[] {
  return useMemo(() => {
    const known = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
    return [...new Set([browserTimezone(), current, ...known])];
  }, [current]);
}
