/** Line/document Home & End for focused text controls (WKWebView often skips default behavior). */

function isTextControl(el: Element | null): el is HTMLInputElement | HTMLTextAreaElement {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLInputElement) {
    const type = (el.type || 'text').toLowerCase();
    return !['checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'hidden', 'range', 'color'].includes(
      type,
    );
  }
  return false;
}

function lineStart(text: string, pos: number): number {
  const i = text.lastIndexOf('\n', Math.max(0, pos - 1));
  return i < 0 ? 0 : i + 1;
}

function lineEnd(text: string, pos: number): number {
  const i = text.indexOf('\n', pos);
  return i < 0 ? text.length : i;
}

function applyHomeEnd(el: HTMLInputElement | HTMLTextAreaElement, e: KeyboardEvent): void {
  const text = el.value;
  const start = el.selectionStart ?? 0;
  const end = el.selectionEnd ?? start;
  const toStart = e.key === 'Home';
  const docBoundary = e.ctrlKey;

  let anchor = start;
  let focus = end;
  if (!e.shiftKey) {
    anchor = focus = toStart ? start : end;
  }

  const target = docBoundary
    ? toStart
      ? 0
      : text.length
    : toStart
      ? lineStart(text, anchor)
      : lineEnd(text, focus);

  if (e.shiftKey) {
    if (toStart) {
      el.setSelectionRange(target, end);
    } else {
      el.setSelectionRange(start, target);
    }
  } else {
    el.setSelectionRange(target, target);
  }
}

export function initTextNavigationKeys(): () => void {
  const handler = (e: KeyboardEvent) => {
    if (e.key !== 'Home' && e.key !== 'End') return;
    if (e.defaultPrevented || e.isComposing) return;
    if (e.altKey || e.metaKey) return;

    const el = document.activeElement;
    if (!isTextControl(el)) return;

    applyHomeEnd(el, e);
    e.preventDefault();
  };

  document.addEventListener('keydown', handler, { capture: true });
  return () => document.removeEventListener('keydown', handler, { capture: true });
}
