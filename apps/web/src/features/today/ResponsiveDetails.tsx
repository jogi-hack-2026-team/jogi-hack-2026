import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from '../../ui/components/Icon.tsx';

/** 初期はdesktopで開く。利用者の開閉は、その後の幅変更でも上書きしない。 */
export function ResponsiveDetails({ summary, children, ariaLabel }: { summary: string; children: ReactNode; ariaLabel?: string }) {
  const [open, setOpen] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 960px)').matches);
  const chosen = useRef(false);
  useEffect(() => {
    const media = window.matchMedia('(min-width: 960px)');
    const sync = () => { if (!chosen.current) setOpen(media.matches); };
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);
  return (
    <details className="fr-today__detail" aria-label={ariaLabel} open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary onClick={() => { chosen.current = true; }}>{summary}<Icon name="chevronDown" size={16} /></summary>
      {children}
    </details>
  );
}
