import type { KeyboardEvent as ReactKeyboardEvent } from 'react';

export type EditorKeyEvent = globalThis.KeyboardEvent | ReactKeyboardEvent;

/** True while an IME is composing (e.g. confirming Latin input with Enter in Chinese mode). */
export function isImeComposing(e: EditorKeyEvent): boolean {
  const native =
    'nativeEvent' in e && e.nativeEvent instanceof KeyboardEvent
      ? e.nativeEvent
      : (e as KeyboardEvent);
  return native.isComposing || native.keyCode === 229;
}
