import { Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useState, type FormEvent } from 'react';
import { authClient, describeAuthError, retryAfterSeconds } from '../auth/client.ts';
import { runAuthAction } from '../auth/action.ts';

type Props = { mode: 'login' | 'register'; redirectTo: string };

const DEFAULT_RETRY_SECONDS = 60;

// 登録とログインは入力項目が同じなので1つのフォームで扱う。429（試行回数の上限）は待ち時間を数えて表示し、
// 経過後に再試行できるようにする。
export function AuthForm({ mode, redirectTo }: Props) {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [retryAt, setRetryAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (retryAt === null) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [retryAt]);
  const remaining = retryAt === null ? 0 : Math.max(0, Math.ceil((retryAt - now) / 1000));
  useEffect(() => {
    if (retryAt !== null && remaining === 0) setRetryAt(null);
  }, [retryAt, remaining]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || remaining > 0) return;
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '').trim();
    const password = String(form.get('password') ?? '');
    setError(null);
    let limited = false;
    const fetchOptions = {
      onError: (context: { response: Response }) => {
        if (context.response.status === 429) {
          limited = true;
          setRetryAt(Date.now() + (retryAfterSeconds(context.response) ?? DEFAULT_RETRY_SECONDS) * 1000);
          setNow(Date.now());
        }
      },
    };
    await runAuthAction(
      () => mode === 'register'
        ? authClient.signUp.email({ email, password, name: email.split('@')[0] || email }, fetchOptions)
        : authClient.signIn.email({ email, password }, fetchOptions),
      {
        setBusy,
        onError: (failure) => { if (!limited) setError(describeAuthError(failure.code, failure.message)); },
        onSuccess: () => navigate({ to: redirectTo }),
      },
    );
  }

  const title = mode === 'register' ? '登録' : 'ログイン';
  return (
    <section>
      <h2>{title}</h2>
      <form onSubmit={submit} aria-describedby="auth-message">
        <p>
          <label>
            メールアドレス <input name="email" type="email" autoComplete="email" required />
          </label>
        </p>
        <p>
          <label>
            パスワード{' '}
            <input name="password" type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} required minLength={8} />
          </label>
        </p>
        <p>
          <button type="submit" disabled={busy || remaining > 0}>
            {title}
          </button>
        </p>
        <p id="auth-message" role="alert" aria-live="polite">
          {remaining > 0 ? `試行回数の上限に達しました。${remaining}秒後に再試行できます。` : error}
        </p>
      </form>
      <p>
        {mode === 'register' ? (
          <>
            登録済みの方は <Link to="/login" search={{ redirect: redirectTo }}>ログイン</Link>
          </>
        ) : (
          <>
            はじめての方は <Link to="/register" search={{ redirect: redirectTo }}>登録</Link>
          </>
        )}
      </p>
    </section>
  );
}
