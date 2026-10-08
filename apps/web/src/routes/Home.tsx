import { Link } from '@tanstack/react-router';
import { authClient } from '../auth/client.ts';
import '../ui/tokens.css';
import '../ui/components/Button.css';

// 公開の入口。Goalの取得と認証ガードは遷移先に任せる。
export function Home() {
  const session = authClient.useSession();
  return (
    <section className="fr">
      <h2>今日サボると、ゴールは何日遠ざかる？</h2>
      <p>Goalを決めて、日々の記録とゴールまでの見通しを確認できます。</p>
      {session.isPending ? <p role="status">確認中</p> : session.data ? (
        <p><Link to="/goals" className="fr-btn fr-btn--primary">Goal一覧を開く</Link></p>
      ) : (
        <>
          <p><Link to="/register" search={{ redirect: '/goals' }} className="fr-btn fr-btn--primary">登録してはじめる</Link></p>
          <p>登録済みの方は <Link to="/login" search={{ redirect: '/goals' }}>ログイン</Link></p>
        </>
      )}
    </section>
  );
}
