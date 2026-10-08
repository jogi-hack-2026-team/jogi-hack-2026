import { Link, useLocation } from '@tanstack/react-router';
import { ApiError } from '../../api/client.ts';
import { isUnauthenticated } from '../../api/http.ts';
import { goalsCopy } from '../../copy/goals.ts';
import { Button } from '../../ui/components/Button.tsx';
import { ErrorPanel } from '../../ui/components/Notice.tsx';
import '../../ui/components/Button.css';

const c = goalsCopy;

/** ログインが切れた（API が 401 を返した）。ログイン後にこの画面へ戻れるよう、今の場所を渡す。 */
export function SignedOutPanel({ body = c.signedOut.body, newTab = false }: { body?: string; newTab?: boolean }) {
  const location = useLocation();
  return (
    <ErrorPanel
      title={c.signedOut.title}
      action={
        <Link
          to="/login"
          search={{ redirect: location.href }}
          className="fr-btn fr-btn--secondary"
          {...(newTab ? { target: '_blank', rel: 'noopener' } : {})}
        >
          {c.signedOut.action}
        </Link>
      }
    >
      {body}
    </ErrorPanel>
  );
}

/**
 * 読み込みの失敗。ログイン切れ・通信の失敗・サーバーの失敗を分けて伝える。
 * 「Goalがない（0件）」とは別の見た目にし、消えたと誤解させない。
 */
export function LoadErrorPanel({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  if (isUnauthenticated(error)) return <SignedOutPanel />;
  return (
    <ErrorPanel
      title={c.loadError.title}
      action={
        <Button icon="retry" onClick={onRetry}>
          {c.loadError.retry}
        </Button>
      }
    >
      {error instanceof ApiError ? c.loadError.serverBody : c.loadError.body}
    </ErrorPanel>
  );
}

export function GoalNotFoundPanel() {
  return (
    <ErrorPanel
      title={c.notFound.title}
      action={
        <Link to="/goals" className="fr-btn fr-btn--secondary">
          {c.notFound.back}
        </Link>
      }
    >
      {c.notFound.body}
    </ErrorPanel>
  );
}
