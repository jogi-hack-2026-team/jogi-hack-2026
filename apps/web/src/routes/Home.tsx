import { useQuery } from '@tanstack/react-query';
import { fetchHealth } from '../api/client.ts';

export function Home() {
  const health = useQuery({ queryKey: ['health'], queryFn: fetchHealth, retry: false });
  const label = health.isPending
    ? '確認中'
    : health.data?.status === 'ok'
      ? '接続できています'
      : '接続できません。APIとDBの起動を確認してください';
  return (
    <section>
      <p>今日サボると、ゴールは何日遠ざかる？</p>
      <p>開発基盤の起動確認画面です。Goal・記録・予測の画面はこれから実装します。</p>
      <p role="status" aria-live="polite">
        API: {label}
      </p>
    </section>
  );
}
