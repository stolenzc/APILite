import { useLayoutEffect, useState, type CSSProperties, type RefObject } from 'react';

const LIST_MAX_HEIGHT = 220;
const VIEWPORT_PAD = 8;

export type DropdownAnchorOptions = {
  /** `below` keeps the menu under the anchor; `auto` may flip above near the viewport bottom. */
  placement?: 'auto' | 'below';
  /** Use the anchor width instead of the default 280px minimum. */
  matchAnchorWidth?: boolean;
};

/** Fixed position below an input inside `anchorRef` (portal dropdowns). */
export function useDropdownAnchorStyle(
  open: boolean,
  anchorRef: RefObject<HTMLElement | null>,
  options: DropdownAnchorOptions = {},
): CSSProperties | undefined {
  const { placement = 'auto', matchAnchorWidth = false } = options;
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
      const minWidth = matchAnchorWidth ? rect.width : Math.max(rect.width, 280);

      let top = rect.bottom + 2;
      let left = rect.left;
      let maxHeight = LIST_MAX_HEIGHT;

      if (placement === 'below') {
        const available = window.innerHeight - VIEWPORT_PAD - top;
        maxHeight = Math.max(80, Math.min(LIST_MAX_HEIGHT, available));
      } else if (top + LIST_MAX_HEIGHT > window.innerHeight - VIEWPORT_PAD) {
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
        maxHeight,
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
  }, [open, anchorRef, placement, matchAnchorWidth]);

  return style;
}
