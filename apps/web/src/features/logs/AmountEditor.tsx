import { useId, useState } from 'react';
import { todayCopy } from '../../copy/today.ts';
import { Button } from '../../ui/components/Button.tsx';
import { Field, fieldAria, NumberInput } from '../../ui/components/FormField.tsx';
import { IconButton } from '../../ui/components/Button.tsx';
import { parseInteger } from '../goals/goal-form.ts';
import './logs.css';

const INT4_MAX = 2_147_483_647;

/**
 * やった量の確認・変更（R-03・R-04「DONEの量は既定で1回の量、変更可」）。デザインキャンバス D1-sheet・E2。
 * ±ボタンは1回の量ずつ増減し、数値の欄で細かく直せる。送る前に1以上の整数かを確かめる。
 */
export function AmountEditor({
  label,
  initial,
  sessionAmount,
  unit,
  busy,
  onSubmit,
  onCancel,
}: {
  label: string;
  initial: number;
  sessionAmount: number;
  unit: string;
  busy: boolean;
  onSubmit: (amount: number) => void;
  onCancel: () => void;
}) {
  const id = useId();
  const [text, setText] = useState(String(initial));
  const [error, setError] = useState<string | undefined>();
  const value = parseInteger(text);
  const step = (delta: number) => {
    const next = Math.min(INT4_MAX, Math.max(1, (value ?? 0) + delta));
    setText(String(next));
    setError(undefined);
  };
  const submit = () => {
    if (value === null || value < 1 || value > INT4_MAX) {
      setError(todayCopy.amountInvalid);
      return;
    }
    onSubmit(value);
  };
  const help = <p>{todayCopy.amountHelp(`${sessionAmount.toLocaleString('ja-JP')}${unit}`)}</p>;

  return (
    <div className="fr-amount">
      <div className="fr-amount__stepper">
        <IconButton icon="minus" label={todayCopy.amountDecrease} disabled={busy || (value ?? 0) <= 1} onClick={() => step(-sessionAmount)} />
        <Field id={id} label={label} error={error} help={help}>
          <NumberInput
            id={id}
            suffix={unit}
            value={text}
            disabled={busy}
            invalid={Boolean(error)}
            onChange={(event) => {
              setText(event.target.value);
              setError(undefined);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submit();
            }}
            {...fieldAria(id, { help, error })}
          />
        </Field>
        <IconButton icon="plus" label={todayCopy.amountIncrease} disabled={busy} onClick={() => step(sessionAmount)} />
      </div>
      <div className="fr-amount__actions">
        <Button variant="primary" busy={busy} onClick={submit}>
          {busy ? todayCopy.saving : todayCopy.saveWithAmount}
        </Button>
        <Button variant="secondary" disabled={busy} onClick={onCancel}>
          {todayCopy.back}
        </Button>
      </div>
    </div>
  );
}
