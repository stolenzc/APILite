import { useLayoutEffect, useState, type CSSProperties, type RefObject } from 'react';

const LIST_MAX_HEIGHT = 220;
const VIEWPORT_PAD = 8;

/** Fixed position below an input inside `anchorRef` (portal dropdowns). */
export function useDropdownAnchorStyle(
  open: boolean,
  anchorRef: RefObject<HTMLElement | null>,
): CSSProperties | undefined {
  const [style, setStyle] = useState<CSSProperties | undefined>(undefined);

  useLayoutEffect(() => {
    if (!open) {
      setStyle(undefined);
      return;
    }

    const update = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;

      const input = anchor.querySelector('input, textarea');
      const rect = (input ?? anchor).getBoundingClientRect();
      const minWidth = Math.max(rect.width, 280);

      let top = rect.bottom + 2;
      let left = rect.left;

      if (top + LIST_MAX_HEIGHT > window.innerHeight - VIEWPORT_PAD) {
        top = Math.max(VIEWPORT_PAD, rect.top - LIST_MAX_HEIGHT - 4);
      }
      if (left + minWidth > window.innerWidth - VIEWPORT_PAD) {
        left = window.innerWidth - minWidth - VIEWPORT_PAD;
      }
      if (left < VIEWPORT_PAD) {
        left = VIEWPORT_PAD;
      }

      setStyle({
        position: 'fixed',
        left,
        top,
        minWidth,
        width: minWidth,
        maxHeight: LIST_MAX_HEIGHT,
        zIndex: 1000,
      });
    };

    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open, anchorRef]);

  return style;
}
