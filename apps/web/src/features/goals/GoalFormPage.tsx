import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { Goal } from '@contracts';
import { goalKeys, goalsHttp } from '../../api/goals-http.ts';
import { isNotFound, isUnauthenticated } from '../../api/http.ts';
import { usePrivateEpoch } from '../../api/session-cache.ts';
import { goalsCopy } from '../../copy/goals.ts';
import { longDate } from '../../copy/date.ts';
import { unitLabel } from '../../copy/today.ts';
import { AppBar } from '../../ui/components/AppBar.tsx';
import { Button } from '../../ui/components/Button.tsx';
import { ConfirmDialog } from '../../ui/components/ConfirmDialog.tsx';
import { Field, fieldAria, NumberInput, SegmentedControl, SelectInput, TextInput } from '../../ui/components/FormField.tsx';
import { Icon } from '../../ui/components/Icon.tsx';
import { ErrorPanel } from '../../ui/components/Notice.tsx';
import { Spinner } from '../../ui/components/Spinner.tsx';
import { StickyActionBar } from '../../ui/components/StickyActionBar.tsx';
import { fetchPolicy } from '../today/fetch-policy.ts';
import {
  emptyValues,
  errorCount,
  FIELD_ORDER,
  fieldErrorsFromApi,
  TITLE_MAX,
  titleLength,
  toCreateBody,
  toPatchBody,
  validate,
  valuesFromGoal,
  type FieldErrors,
  type FieldName,
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
  const { owner } = usePrivateEpoch();
  return <GoalForm key={owner ?? ''} mode="create" />;
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
    />
  );
}

function FormShell({ title, body }: { title: string; body: ReactNode }) {
  return (
    <div className="fr fr-page">
      <AppBar title={title} leading={<CloseLink />} />
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

function FormLoading() {
  return (
    <p className="fr-goals__help fr-goals__loading" role="status">
      <Spinner />
      {c.loadingVisible}
    </p>
  );
}

type Props =
  | { mode: 'create'; goal?: undefined; refreshError?: undefined; onRetryRefresh?: undefined }
  | { mode: 'edit'; goal: Goal; refreshError: unknown; onRetryRefresh: () => void };

function GoalForm({ mode, goal, refreshError, onRetryRefresh }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const locked = mode === 'edit' && goal.hasLogs;
  const [values, setValues] = useState<FormValues>(() => (goal ? valuesFromGoal(goal) : emptyValues(browserTimezone())));
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
  const [baseline] = useState(goal);
  // この画面がまだ表示されているか。保存の途中で離れた後に、別の画面を一覧へ移さないために使う
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const clientErrors = submitted ? validate(values, { locked }) : {};
  const errors: FieldErrors = { ...serverErrors, ...clientErrors };
  const count = errorCount(errors);

  const save = useMutation({
    mutationFn: async (v: FormValues): Promise<Goal | null> => {
      if (mode === 'create') return goalsHttp.createGoal(toCreateBody(v));
      // 記録の有無は最新の Goal に従う（記録が付いた後は timezone・initialProgress を送らない）
      const patch = toPatchBody(v, { ...baseline!, hasLogs: goal.hasLogs });
      return patch ? goalsHttp.updateGoal(goal.id, patch) : null;
    },
    // 一覧などの取り直しは、画面を離れていても必ず行う。一覧への移動は mutate に渡す onSuccess で、表示中のときだけ行う
    onSuccess: () => queryClient.invalidateQueries({ queryKey: goalKeys.all }),
    onError: (error) => {
      saving.current = false;
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
    if (saving.current) return;
    setSubmitted(true);
    setServerErrors({});
    const found = validate(values, { locked });
    if (errorCount(found) > 0) {
      focusFirstError(found);
      return;
    }
    saving.current = true;
    save.mutate(values, { onSuccess: leaveToList });
  };

  const focusFirstError = (found: FieldErrors) => {
    const first = FIELD_ORDER.find((name) => found[name]);
    if (!first) return;
    const target = formRef.current?.querySelector<HTMLElement>(first === 'unit' ? '[aria-labelledby="goal-unit-label"] button' : `#goal-${first}`);
    target?.focus();
  };

  const busy = save.isPending;
  useEffect(() => {
    if (!focusAfterSave || busy) return;
    focusFirstError(focusAfterSave);
    setFocusAfterSave(null);
  }, [focusAfterSave, busy]);
  const unit = unitLabel(values.unit);
  const timezones = useTimezones(values.timezone);
  // 422 で項目に割り当てられたエラーは各項目に出す。それ以外（通信・サーバー・ログイン切れ）は保存ボタンの上に出す
  const apiFieldErrors = save.isError ? fieldErrorsFromApi(save.error) : null;
  const saveFailure = save.isError && (apiFieldErrors === null || errorCount(apiFieldErrors) === 0) ? save.error : null;
  const showSaveFailure = saveFailure !== null && count === 0;
  // 通信・サーバーの失敗は「もう一度保存」。ログイン切れはログインし直すまで同じ文言のままにする
  const canRetry = showSaveFailure && !isUnauthenticated(saveFailure);

  return (
    <div className="fr fr-page">
      <AppBar title={mode === 'create' ? f.createTitle : f.editTitle} leading={<CloseLink />} />
      <form ref={formRef} className="fr-goalform" noValidate onSubmit={onSubmit} aria-busy={busy || undefined}>
        <div className="fr-goalform__fields">
          {refreshError && onRetryRefresh ? <RefreshFailed error={refreshError} onRetry={onRetryRefresh} /> : null}
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
              disabled={busy}
              invalid={Boolean(errors.title)}
              autoComplete="off"
              {...fieldAria('goal-title', { error: errors.title })}
            />
          </Field>

          <Field id="goal-unit" label={f.unit} group error={errors.unit}>
            <SegmentedControl
              labelledBy="goal-unit-label"
              options={[
                { value: 'minutes', label: f.units.minutes },
                { value: 'sessions', label: f.units.sessions },
              ]}
              value={values.unit}
              onChange={(value) => update('unit', value)}
              disabled={busy}
            />
          </Field>

          <AmountField id="goal-totalRequired" label={f.totalRequired} unit={unit} value={values.totalRequired} error={errors.totalRequired} disabled={busy} onChange={(v) => update('totalRequired', v)} />
          <AmountField id="goal-sessionAmount" label={f.sessionAmount} unit={unit} value={values.sessionAmount} error={errors.sessionAmount} disabled={busy} onChange={(v) => update('sessionAmount', v)} />
          <AmountField
            id="goal-initialProgress"
            label={f.initialProgress}
            unit={unit}
            value={values.initialProgress}
            error={errors.initialProgress}
            disabled={busy || locked}
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
              disabled={busy || locked}
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

          {mode === 'edit' ? (
            <div>
              <Button variant="text" icon="trash" disabled={busy} onClick={() => setDeleteOpen(true)}>
                {f.delete}
              </Button>
            </div>
          ) : null}
        </div>

        <StickyActionBar>
          <div className="fr-goalform__actions">
            {showSaveFailure ? <SaveFailure error={saveFailure} mode={mode} /> : null}
            <Button type="submit" variant="primary" block busy={busy} {...(canRetry ? { icon: 'retry' as const } : {})}>
              {busy ? f.saving : canRetry ? f.saveFailed.retry : mode === 'create' ? f.save : f.saveEdit}
            </Button>
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
function RefreshFailed({ error, onRetry }: { error: unknown; onRetry: () => void }) {
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
      {isNotFound(error) ? f.refreshFailed.notFound : f.refreshFailed.body}
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
function SaveFailure({ error, mode }: { error: unknown; mode: 'create' | 'edit' }) {
  if (isUnauthenticated(error)) return <SignedOutPanel body={c.signedOut.formBody} newTab />;
  return (
    <ErrorPanel title={f.saveFailed.title}>
      {mode === 'create' ? f.saveFailed.createBody : f.saveFailed.editBody}
    </ErrorPanel>
  );
}

/** 選べるタイムゾーン。ブラウザが知っている IANA 名に、今の値（ブラウザ設定・保存済みの値）を必ず含める。 */
function useTimezones(current: string): string[] {
  return useMemo(() => {
    const known = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
    return [...new Set([browserTimezone(), current, ...known])];
  }, [current]);
}
