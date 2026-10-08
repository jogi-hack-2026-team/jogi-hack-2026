import './Spinner.css';

// 読み込み中・保存中の回転する印。意味は隣の文字で伝え、印そのものは読み上げない。
export function Spinner() {
  return <span className="fr-spinner" aria-hidden="true" />;
}
