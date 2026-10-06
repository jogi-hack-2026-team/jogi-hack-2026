import { useQuery } from '@tanstack/react-query';
import { fetchHealth } from '../api/client.ts';

// 深いURL（/health）への直接アクセスでもSPAが表示されることの確認にも使う。
export function HealthPage() {
  const health = useQuery({ queryKey: ['health'], queryFn: fetchHealth, retry: false });
  return (
    <section>
      <h2>接続確認</h2>
      {health.isPending && <p>確認中</p>}
      {health.data && (
        <dl>
          <dt>API</dt>
          <dd>{health.data.status}</dd>
          <dt>Database</dt>
          <dd>{health.data.database}</dd>
        </dl>
      )}
      {health.error && <p role="alert">取得に失敗しました: {health.error.message}</p>}
    </section>
  );
}
