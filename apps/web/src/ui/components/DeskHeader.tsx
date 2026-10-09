import type { ReactNode } from 'react';
import { todayCopy } from '../../copy/today.ts';
import './DeskHeader.css';

/**
 * デスクトップ幅で、画面ごとの上のバー（AppBar）の代わりに出す戻り先と見出し（デザイン Desk-create・Desk-edit・Desk-history）。
 * 上のバーは画面全体のもの（AppShell）1段にし、戻る操作はここに置く。スマートフォン幅では出さない（AppBar を使う）。
 * 外側の .fr-page に fr-page--desk を付けると、デスクトップ幅で AppBar を隠してこれを出す（page.css）。
 */
export function DeskHeader({ back, title, titleAs = 'h1' }: { back: ReactNode; title: string; titleAs?: 'h1' | 'p' }) {
  const Title = titleAs;
  return (
    <div className="fr-deskhead">
      <nav aria-label={todayCopy.breadcrumb}>{back}</nav>
      <Title className="fr-deskhead__title">{title}</Title>
    </div>
  );
}
