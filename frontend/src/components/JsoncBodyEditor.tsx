import { useEffect, useMemo, useRef } from 'react';
import { EnvVarField } from './EnvVarField';
import LineNumberGutter, { type LineNumberGutterHandle } from './LineNumberGutter';
import { highlightJson } from '../utils/jsonUtils';

type Props = {
  value: string;
  onValueChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
};

export default function JsoncBodyEditor({ value, onValueChange, onKeyDown, placeholder }: Props) {
  const highlightRef = useRef<HTMLPreElement>(null);
  const gutterRef = useRef<LineNumberGutterHandle>(null);

  const highlightedHtml = useMemo(() => highlightJson(value), [value]);

  const editorRef = useRef<HTMLDivElement>(null);

  const syncScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    const top = e.currentTarget.scrollTop;
    const left = e.currentTarget.scrollLeft;
    const layer = highlightRef.current;
    if (layer) {
      layer.scrollTop = top;
      layer.scrollLeft = left;
    }
    gutterRef.current?.syncScrollTop(top);
  };

  useEffect(() => {
    const root = editorRef.current;
    if (!root) return;
    const onScroll = (e: Event) => {
      if (!(e.target instanceof HTMLTextAreaElement)) return;
      if (!root.contains(e.target)) return;
      const top = e.target.scrollTop;
      const layer = highlightRef.current;
      if (layer) {
        layer.scrollTop = top;
        layer.scrollLeft = e.target.scrollLeft;
      }
      gutterRef.current?.syncScrollTop(top);
    };
    root.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => root.removeEventListener('scroll', onScroll, { capture: true });
  }, []);

  return (
    <div className="jsonc-editor" ref={editorRef}>
      <div className="jsonc-editor-with-gutter">
        <LineNumberGutter ref={gutterRef} text={value} className="jsonc-editor-gutter" />
        <div className="jsonc-editor-viewport">
        <pre
          ref={highlightRef}
          className="jsonc-editor-highlight json-highlight jsonc-editor-layer"
          aria-hidden
          dangerouslySetInnerHTML={{ __html: highlightedHtml }}
        />
        <EnvVarField
          as="textarea"
          className="body-editor jsonc-editor-input jsonc-editor-layer"
          value={value}
          onValueChange={onValueChange}
          onKeyDown={onKeyDown}
          onScroll={syncScroll}
          wrap="off"
          placeholder={placeholder}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
        />
        </div>
      </div>
    </div>
  );
}
