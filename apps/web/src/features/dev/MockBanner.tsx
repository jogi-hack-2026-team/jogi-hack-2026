import { Link } from '@tanstack/react-router';
import { scenarios, fixtureSource } from '../../api/mock/scenarios.ts';
import { usingMockApi } from '../../api/goals-api.ts';
import './MockBanner.css';

/**
 * 仮APIを使っている間だけ出す案内。未確定のAPIを仮だと分かるようにし、画面の状態（シナリオ）を切り替えられるようにする。
 * 実APIにつないだら usingMockApi が false になり、表示されなくなる。
 */
export function MockBanner({ currentGoalId }: { currentGoalId?: string }) {
  if (!usingMockApi) return null;
  const current = scenarios.find((s) => s.id === currentGoalId);
  return (
    <aside className="fr-mock" aria-label="仮のデータの案内">
      <p className="fr-mock__title">仮のデータで表示しています</p>
      <p className="fr-mock__text">
        実際のAPIにはまだつないでいません。予測の値は Engine の例（{fixtureSource.commit}）の実出力です。
        {current ? ` いまの状態：${current.label}` : ''}
      </p>
      <details className="fr-mock__list">
        <summary>ほかの状態を見る</summary>
        <ul>
          {scenarios.map((s) => (
            <li key={s.id}>
              <Link to="/goals/$goalId" params={{ goalId: s.id }} aria-current={s.id === currentGoalId ? 'page' : undefined}>
                {s.label}
              </Link>
            </li>
          ))}
        </ul>
      </details>
    </aside>
  );
}
