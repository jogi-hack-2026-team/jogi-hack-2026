import { Link } from '@tanstack/react-router';
import { useEffect, useId, useRef, useState } from 'react';
import { todayCopy } from '../../copy/today.ts';
import { Icon } from '../../ui/components/Icon.tsx';

/**
 * Today の上のバー右の「Goalのメニュー」（デザインキャンバス D1・P3）。画面の主役（問いと数字）を邪魔しないよう、
 * Goal の編集と、記録済みの昨日の訂正（P3 の入口）をここにまとめる。
 * 開くと最初の項目へフォーカスを移し、Esc・外側のクリック・項目の選択で閉じる（Esc ではボタンへフォーカスを戻す）。
 */
export function GoalMenu({ goalId, onCorrectYesterday }: { goalId: string; onCorrectYesterday?: (() => void) | undefined }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  // スマートフォン幅とデスクトップ幅で別の場所に置くので、id は置き場所ごとに分ける
  const menuId = useId();

  useEffect(() => {
    if (!open) return undefined;
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const onPointer = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  };

  return (
    <div
      ref={rootRef}
      className="fr-menu"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.stopPropagation();
          close(true);
        }
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        className="fr-icon-btn"
        aria-label={todayCopy.goalMenu}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name="more" />
      </button>
      {open ? (
        <div ref={menuRef} id={menuId} className="fr-menu__list" role="menu" aria-label={todayCopy.goalMenu}>
          <Link to="/goals/$goalId/edit" params={{ goalId }} role="menuitem" className="fr-menu__item" onClick={() => setOpen(false)}>
            <Icon name="edit" size={20} />
            {todayCopy.menuEdit}
          </Link>
          <Link to="/goals/$goalId/history" params={{ goalId }} role="menuitem" className="fr-menu__item" onClick={() => setOpen(false)}>
            <Icon name="calendar" size={20} />
            {todayCopy.menuHistory}
          </Link>
          {onCorrectYesterday ? (
            <button
              type="button"
              role="menuitem"
              className="fr-menu__item"
              onClick={() => {
                close(false);
                onCorrectYesterday();
              }}
            >
              <Icon name="retry" size={20} />
              {todayCopy.menuCorrectYesterday}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
