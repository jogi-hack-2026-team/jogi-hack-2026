import { Link } from '@tanstack/react-router';
import { authClient } from '../auth/client.ts';

// ログイン後のホーム。Goal・記録・予測の画面は#78〜#81で追加する。
export function Home() {
  const session = authClient.useSession();
  if (session.isPending) return <p>確認中</p>;
  if (!session.data) {
    // 画面表示中にセッションが切れた場合（期限切れ・別タブでのログアウト）
    return (
      <p role="alert">
        ログインが必要です。<Link to="/login" search={{ redirect: '/' }}>ログイン</Link>
      </p>
    );
  }
  return (
    <section>
      <p>今日サボると、ゴールは何日遠ざかる？</p>
      <p>
        <strong>{session.data.user.email}</strong> でログインしています。Goal・記録・予測の画面はこれから実装します。
      </p>
    </section>
  );
}
