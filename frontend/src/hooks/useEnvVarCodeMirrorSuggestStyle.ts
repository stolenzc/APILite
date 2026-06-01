import { useLayoutEffect, useState, type CSSProperties, type RefObject } from 'react';
import type { EditorView } from '@codemirror/view';

const LIST_MAX_HEIGHT = 200;
const VIEWPORT_PAD = 8;

export function useEnvVarCodeMirrorSuggestStyle(
  open: boolean,
  viewRef: RefObject<EditorView | null>,
  caretIndex: number,
): CSSProperties | undefined {
  const [style, setStyle] = useState<CSSProperties | undefined>(undefined);

  useLayoutEffect(() => {
    if (!open) {
      setStyle(undefined);
      return;
    }

    const update = () => {
      const view = viewRef.current;
      if (!view) return;

      const coords = view.coordsAtPos(Math.min(caretIndex, view.state.doc.length));
      if (!coords) return;

      const minWidth = 200;

      let top = coords.bottom + 2;
      let left = coords.left;

      if (top + LIST_MAX_HEIGHT > window.innerHeight - VIEWPORT_PAD) {
        top = coords.top - LIST_MAX_HEIGHT - 4;
      }
      if (top < VIEWPORT_PAD) {
        top = coords.bottom + 2;
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
    const view = viewRef.current;
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    view?.scrollDOM.addEventListener('scroll', update);

    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
      view?.scrollDOM.removeEventListener('scroll', update);
    };
  }, [open, viewRef, caretIndex]);

  return style;
}
