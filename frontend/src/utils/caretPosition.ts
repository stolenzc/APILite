const MIRROR_PROPS = [
  'direction',
  'boxSizing',
  'width',
  'height',
  'overflowX',
  'overflowY',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'fontStyle',
  'fontVariant',
  'fontWeight',
  'fontStretch',
  'fontSize',
  'lineHeight',
  'fontFamily',
  'textAlign',
  'textTransform',
  'textIndent',
  'textDecoration',
  'letterSpacing',
  'wordSpacing',
  'tabSize',
] as const;

export type CaretViewportRect = {
  left: number;
  top: number;
  height: number;
};

function copyInputStyle(element: HTMLInputElement | HTMLTextAreaElement, mirror: HTMLDivElement): void {
  const win = element.ownerDocument.defaultView ?? window;
  const cs = win.getComputedStyle(element);
  for (const prop of MIRROR_PROPS) {
    const kebab = prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
    mirror.style.setProperty(kebab, cs.getPropertyValue(kebab));
  }
}

/**
 * Viewport coordinates of the caret in an input/textarea (mirror-div technique).
 */
export function getCaretViewportRect(
  element: HTMLInputElement | HTMLTextAreaElement,
  position: number,
): CaretViewportRect {
  const doc = element.ownerDocument;
  const win = doc.defaultView ?? window;
  const cs = win.getComputedStyle(element);
  const elRect = element.getBoundingClientRect();

  const mirror = doc.createElement('div');
  mirror.setAttribute('aria-hidden', 'true');
  copyInputStyle(element, mirror);

  const ms = mirror.style;
  ms.position = 'fixed';
  ms.visibility = 'hidden';
  ms.whiteSpace = element instanceof HTMLTextAreaElement ? 'pre-wrap' : 'pre';
  ms.wordWrap = 'break-word';
  ms.top = `${elRect.top}px`;
  ms.left = `${elRect.left}px`;
  ms.width = `${elRect.width}px`;
  ms.height = `${elRect.height}px`;
  ms.overflow = 'hidden';
  ms.zIndex = '-1';

  if (element instanceof HTMLTextAreaElement) {
    mirror.scrollTop = element.scrollTop;
    mirror.scrollLeft = element.scrollLeft;
  }

  const value = element.value;
  const pos = Math.max(0, Math.min(position, value.length));
  const before = value.slice(0, pos);
  const after = value.slice(pos) || '.';

  mirror.textContent = before;
  const marker = doc.createElement('span');
  marker.textContent = after[0] === '\n' ? '\u200b' : after;
  mirror.appendChild(marker);

  doc.body.appendChild(mirror);

  const markerRect = marker.getBoundingClientRect();
  const lineHeight = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2 || 16;

  doc.body.removeChild(mirror);

  return {
    left: markerRect.left,
    top: markerRect.top,
    height: markerRect.height > 0 ? markerRect.height : lineHeight,
  };
}
