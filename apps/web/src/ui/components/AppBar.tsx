import type { ReactNode } from 'react';
import './AppBar.css';

// 画面上部のバー。左右には IconButton などを置き、置かない側は同じ幅の空きで中央をそろえる。
export function AppBar({ title, leading, trailing }: { title: string; leading?: ReactNode; trailing?: ReactNode }) {
  return (
    <header className="fr-appbar">
      {leading ?? <span className="fr-appbar__spacer" />}
      <p className="fr-appbar__title">{title}</p>
      {trailing ?? <span className="fr-appbar__spacer" />}
    </header>
  );
}
