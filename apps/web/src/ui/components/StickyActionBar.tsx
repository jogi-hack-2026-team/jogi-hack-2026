import type { ReactNode } from 'react';
import './StickyActionBar.css';

// 画面の下に固定し、スクロールに追従する操作の帯（記録の2択・保存ボタンなど）。
// 2つ並べるときは columns={2} にする。
export function StickyActionBar({ children, note, columns = 1 }: { children: ReactNode; note?: ReactNode; columns?: 1 | 2 }) {
  return (
    <div className="fr-actionbar">
      {note ? <p className="fr-actionbar__note">{note}</p> : null}
      <div className={columns === 2 ? 'fr-actionbar__pair' : 'fr-actionbar__single'}>{children}</div>
    </div>
  );
}
