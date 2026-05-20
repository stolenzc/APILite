import { useLayoutEffect, useState, type CSSProperties, type RefObject } from 'react';
import { getCaretViewportRect } from '../utils/caretPosition';

const LIST_MAX_HEIGHT = 200;
const VIEWPORT_PAD = 8;

export function useEnvVarCaretSuggestStyle(
  open: boolean,
  inputRef: RefObject<HTMLInputElement | HTMLTextAreaElement | null>,
  caretIndex: number,
): CSSProperties | undefined {
  const [style, setStyle] = useState<CSSProperties | undefined>(undefined);

  useLayoutEffect(() => {
    if (!open) {
      setStyle(undefined);
      return;
    }

    const update = () => {
      const el = inputRef.current;
      if (!el) return;

      const caret = getCaretViewportRect(el, caretIndex);
      const elRect = el.getBoundingClientRect();
      const minWidth = Math.min(320, Math.max(200, elRect.width));

      let top = caret.top + caret.height + 2;
      let left = caret.left;

      if (top + LIST_MAX_HEIGHT > window.innerHeight - VIEWPORT_PAD) {
        top = caret.top - LIST_MAX_HEIGHT - 4;
      }
      if (top < VIEWPORT_PAD) {
        top = caret.top + caret.height + 2;
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
        maxWidth: Math.max(minWidth, 420),
        maxHeight: LIST_MAX_HEIGHT,
        zIndex: 1000,
      });
    };

    update();
    const el = inputRef.current;
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    el?.addEventListener('scroll', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
      el?.removeEventListener('scroll', update);
    };
  }, [open, inputRef, caretIndex]);

  return style;
}
