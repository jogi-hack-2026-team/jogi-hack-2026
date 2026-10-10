import { useId, useState } from 'react';
import { todayCopy } from '../../copy/today.ts';
import { Button } from '../../ui/components/Button.tsx';
import { Field, fieldAria, NumberInput } from '../../ui/components/FormField.tsx';
import { IconButton } from '../../ui/components/Button.tsx';
import { isRecordAmount, RECORD_AMOUNT_MAX, RECORD_AMOUNT_MIN, stepRecordAmount, type AmountFormat } from '../../copy/amount.ts';
import { parseInteger } from '../goals/goal-form.ts';
import './logs.css';

/**
 * やった量の確認・変更（R-03・R-04「DONEの量は既定で1回の量、変更可」）。デザインキャンバス D1-sheet・E2。
 * ±ボタンは1回の量ずつ増減し、数値の欄で細かく直せる。送る前に1以上の整数かを確かめる。
 */
export function AmountEditor({
  label,
  initial,
  sessionAmount,
  fmt,
  busy,
  onSubmit,
  onCancel,
  submitLabel = todayCopy.saveWithAmount,
  cancelLabel = todayCopy.back,
}: {
  label: string;
  initial: number;
  sessionAmount: number;
  /** 量の書き方（記録は分か回の整数で入力する、P-18）。 */
  fmt: AmountFormat;
  busy: boolean;
  onSubmit: (amount: number) => void;
  onCancel: () => void;
  /** 主ボタンの文言（既定は「この量で記録」。昨日の訂正では「変更を保存」）。 */
  submitLabel?: string;
  cancelLabel?: string;
}) {
  const id = useId();
  const [text, setText] = useState(String(initial));
  const [error, setError] = useState<string | undefined>();
  const value = parseInteger(text);
  const valid = isRecordAmount(value);
  const step = (direction: -1 | 1) => {
    if (busy || !valid) return;
    // 同じevent batchの連打でも、前の更新後の入力値を基準にする。
    setText((previous) => {
      const current = parseInteger(previous);
      return isRecordAmount(current) ? String(stepRecordAmount(current, sessionAmount, direction)) : previous;
    });
    setError(undefined);
  };
  const submit = () => {
    if (busy) return;
    if (!valid) {
      setError(todayCopy.amountInvalid);
      return;
    }
    onSubmit(value);
  };
  const help = <p>{todayCopy.amountHelp(fmt.record(sessionAmount))}</p>;
  const aria = fieldAria(id, { help, error });

  return (
    <div className="fr-amount">
      <div className="fr-amount__stepper">
        <IconButton icon="minus" label={`${todayCopy.amountDecrease}（${fmt.record(sessionAmount)}ずつ）`} disabled={busy || !valid || value <= RECORD_AMOUNT_MIN} onClick={() => step(-1)} />
        <Field id={id} label={label} error={error} help={help}>
          <NumberInput
            id={id}
            suffix={fmt.recordUnit}
            value={text}
            autoFocus
            disabled={busy}
            invalid={Boolean(error)}
            role="spinbutton"
            aria-valuemin={RECORD_AMOUNT_MIN}
            aria-valuemax={RECORD_AMOUNT_MAX}
            aria-valuenow={valid ? value : undefined}
            aria-valuetext={valid ? fmt.record(value) : undefined}
            onChange={(event) => {
              setText(event.target.value);
              setError(undefined);
            }}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing || busy) return;
              if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                event.preventDefault();
                step(event.key === 'ArrowUp' ? 1 : -1);
              } else if (event.key === 'Enter' && !event.repeat) {
                event.preventDefault();
                submit();
              }
            }}
            {...aria}
            aria-describedby={`${aria['aria-describedby']} ${id}-prediction-note`}
          />
        </Field>
        <IconButton icon="plus" label={`${todayCopy.amountIncrease}（${fmt.record(sessionAmount)}ずつ）`} disabled={busy || !valid || value >= RECORD_AMOUNT_MAX} onClick={() => step(1)} />
      </div>
      <p id={`${id}-prediction-note`} className="fr-amount__prediction-note">{todayCopy.amountPredictionNote}</p>
      <div className="fr-amount__actions">
        <Button variant="primary" busy={busy} onClick={submit}>
          {busy ? todayCopy.saving : submitLabel}
        </Button>
        <Button variant="secondary" disabled={busy} onClick={onCancel}>
          {cancelLabel}
        </Button>
      </div>
    </div>
  );
}
