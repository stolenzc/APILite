/** True while an IME is composing (e.g. confirming Latin input with Enter in Chinese mode). */
export function isImeComposing(e: KeyboardEvent | React.KeyboardEvent): boolean {
  const native =
    'nativeEvent' in e && e.nativeEvent instanceof KeyboardEvent
      ? e.nativeEvent
      : (e as KeyboardEvent);
  return native.isComposing || native.keyCode === 229;
}
