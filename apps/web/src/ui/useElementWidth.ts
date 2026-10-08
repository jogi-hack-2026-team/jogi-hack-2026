import { useLayoutEffect, useRef, useState } from 'react';

/**
 * 要素の実際の幅（px）を測り、変わったら更新する。
 * 図を viewBox で縮めると文字まで小さくなるため、図は測った幅で座標を計算して描く（文字は常に指定の大きさ）。
 * 測れるまでは fallback を使う。
 */
export function useElementWidth<T extends HTMLElement>(fallback: number) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const w = Math.round(el.getBoundingClientRect().width);
      if (w > 0) setWidth(w);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}
