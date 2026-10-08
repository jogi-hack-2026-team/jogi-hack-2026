import { useNavigate } from '@tanstack/react-router';
import { useEffect, useId, useRef, useState } from 'react';
import { authClient, describeAuthError } from '../../auth/client.ts';
import { runAuthAction } from '../../auth/action.ts';
import { appCopy } from '../../copy/app.ts';
import { Button, IconButton } from '../../ui/components/Button.tsx';
import './account.css';

const c = appCopy.account;

/**
 * 上のバーのアカウントボタンと、下から出るアカウントのシート（デザイン B-account）。
 * ログイン中のメールアドレスとログアウトを置く。ブラウザ標準の <dialog> をモーダルで開き、Esc と「閉じる」で閉じる。
 * ログアウト後はログイン画面へ移り、履歴を置き換える（「戻る」でログアウト前の画面を開き直さない）。
 */
export function AccountMenu({ variant = 'icon' }: { variant?: 'icon' | 'email' }) {
  const session = authClient.useSession();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDialogElement>(null);
  // スマートフォン幅とデスクトップ幅の上のバーの両方に置くので、見出しの id は置き場所ごとに分ける
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  // 開く前にフォーカスがあった場所（アカウントボタン）。閉じたら戻す
  const returnTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      returnTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
      closeRef.current?.focus();
    }
    if (!open && dialog.open) {
      dialog.close();
      returnTo.current?.focus();
    }
  }, [open]);

  const logout = () =>
    runAuthAction(() => authClient.signOut(), {
      setBusy,
      onError: (failure) => setError(describeAuthError(failure.code, failure.message)),
      onSuccess: () => navigate({ to: '/login', search: { redirect: '/goals' }, replace: true }),
    });

  return (
    <>
      {variant === 'icon' ? (
        <IconButton
          icon="user"
          label={c.open}
          aria-haspopup="dialog"
          onClick={() => {
            setError(null);
            setOpen(true);
          }}
        />
      ) : (
        // デスクトップ幅の上のバー（デザイン Desk-home・Desk-today）では、ログイン中のメールアドレスをボタンにする
        <Button
          variant="text"
          icon="user"
          aria-haspopup="dialog"
          aria-label={`${c.open}（${session.data?.user.email ?? ''}）`}
          onClick={() => {
            setError(null);
            setOpen(true);
          }}
        >
          <span className="fr-account__email">{session.data?.user.email ?? ''}</span>
        </Button>
      )}
      <dialog
        ref={ref}
        className="fr-sheet"
        aria-labelledby={titleId}
        onCancel={(event) => {
          event.preventDefault();
          if (!busy) setOpen(false);
        }}
        onClick={(event) => {
          // シートの外（背景）を押したら閉じる。シートの余白を押しても target は dialog になるので、位置で見分ける
          const dialog = ref.current;
          if (!dialog || event.target !== dialog || busy) return;
          const box = dialog.getBoundingClientRect();
          const inside = event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom;
          if (!inside) setOpen(false);
        }}
      >
        <span className="fr-sheet__grab" aria-hidden="true" />
        <h2 className="fr-sheet__title" id={titleId}>
          {c.title}
        </h2>
        <dl className="fr-account__info">
          <div className="fr-account__kv">
            <dt>{c.signedInAs}</dt>
            <dd>{session.data?.user.email ?? ''}</dd>
          </div>
        </dl>
        {error ? (
          <p className="fr-account__error" role="alert">
            {error}
          </p>
        ) : null}
        <Button icon="logout" block busy={busy} onClick={() => void logout()}>
          {busy ? c.loggingOut : c.logout}
        </Button>
        <Button ref={closeRef} variant="text" block disabled={busy} onClick={() => setOpen(false)}>
          {c.close}
        </Button>
      </dialog>
    </>
  );
}
