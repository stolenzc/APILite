import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

export const KV_KEY_COL_DEFAULT_CH = 20;
export const KV_KEY_COL_MIN_CH = 6;
export const KV_KEY_COL_MAX_CH = 48;
const STORAGE_KEY = 'APILite-kv-key-col-ch';

function readStoredWidth(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw == null) return KV_KEY_COL_DEFAULT_CH;
    const n = Number.parseFloat(raw);
    if (!Number.isFinite(n)) return KV_KEY_COL_DEFAULT_CH;
    return Math.min(KV_KEY_COL_MAX_CH, Math.max(KV_KEY_COL_MIN_CH, n));
  } catch {
    return KV_KEY_COL_DEFAULT_CH;
  }
}

function measureChPx(container: HTMLElement | null): number {
  if (!container) return 8;
  const probe = document.createElement('span');
  probe.textContent = '0';
  probe.style.cssText =
    'position:absolute;visibility:hidden;white-space:pre;font:12px var(--font-mono), monospace';
  container.appendChild(probe);
  const w = probe.getBoundingClientRect().width || 8;
  probe.remove();
  return w > 0 ? w : 8;
}

export function useKvKeyColumnWidth(containerRef: RefObject<HTMLElement | null>) {
  const [widthCh, setWidthCh] = useState(readStoredWidth);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startWidthCh = useRef(widthCh);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(widthCh));
    } catch {
      /* ignore */
    }
  }, [widthCh]);

  const startResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragging.current = true;
      startX.current = e.clientX;
      startWidthCh.current = widthCh;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [widthCh],
  );

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const chPx = measureChPx(containerRef.current);
      const deltaCh = (e.clientX - startX.current) / chPx;
      const next = Math.min(
        KV_KEY_COL_MAX_CH,
        Math.max(KV_KEY_COL_MIN_CH, startWidthCh.current + deltaCh),
      );
      setWidthCh(Math.round(next * 10) / 10);
    };

    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [containerRef]);

  return { widthCh, startResize };
}
