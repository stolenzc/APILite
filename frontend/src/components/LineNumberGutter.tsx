import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { lineCountFromText } from '../utils/lineNumbers';

export type LineNumberGutterHandle = {
  syncScrollTop: (top: number) => void;
};

type Props = {
  text: string;
  className?: string;
};

const LineNumberGutter = forwardRef<LineNumberGutterHandle, Props>(function LineNumberGutter(
  { text, className },
  ref,
) {
  const innerRef = useRef<HTMLDivElement>(null);
  const lineCount = useMemo(() => lineCountFromText(text), [text]);

  useImperativeHandle(ref, () => ({
    syncScrollTop(top: number) {
      const inner = innerRef.current;
      if (!inner) return;
      inner.style.transform = top > 0 ? `translateY(-${top}px)` : '';
    },
  }));

  return (
    <div
      className={`line-number-gutter${className ? ` ${className}` : ''}`}
      aria-hidden
    >
      <div ref={innerRef} className="line-number-gutter-inner">
        {Array.from({ length: lineCount }, (_, i) => (
          <div key={i} className="line-number-row">
            {i + 1}
          </div>
        ))}
      </div>
    </div>
  );
});

export default LineNumberGutter;
