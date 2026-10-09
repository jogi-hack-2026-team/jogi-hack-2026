import { Link } from '@tanstack/react-router';
import { authClient } from '../auth/client.ts';
import { appCopy } from '../copy/app.ts';
import { PageTitle } from '../ui/components/PageTitle.tsx';
import { Spinner } from '../ui/components/Spinner.tsx';
import '../ui/tokens.css';
import '../ui/components/Button.css';
import './auth.css';

// 公開の入口（P-16）。Goalの取得と認証ガードは遷移先に任せる。見た目はログイン画面（デザイン A1）の上部と同じ形にそろえる
export function Home() {
  const session = authClient.useSession();
  return (
    <main className="fr fr-auth">
      <PageTitle />
      <div className="fr-auth__head">
        <h1 className="fr-auth__name">{appCopy.name}</h1>
        <p className="fr-auth__tagline">{appCopy.tagline}</p>
      </div>
      <p className="fr-auth__lead">Goalを決めて、日々の記録とゴールまでの見通しを確認できます。</p>
      {session.isPending ? (
        <p className="fr-auth__status" role="status">
          <Spinner />
          確認中
        </p>
      ) : session.data ? (
        <Link to="/goals" className="fr-btn fr-btn--primary fr-btn--block">
          Goal一覧を開く
        </Link>
      ) : (
        <div className="fr-auth__actions">
          <Link to="/register" search={{ redirect: '/goals' }} className="fr-btn fr-btn--primary fr-btn--block">
            登録してはじめる
          </Link>
          <p className="fr-auth__lead">
            登録済みの方は{' '}
            <Link to="/login" search={{ redirect: '/goals' }} className="fr-auth__link">
              ログイン
            </Link>
          </p>
        </div>
      )}
    </main>
  );
}
