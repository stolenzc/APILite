import { useMemo, useRef } from 'react';
import { EnvVarField } from './EnvVarField';
import { highlightJson } from '../utils/jsonUtils';

type Props = {
  value: string;
  onValueChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
};

export default function JsoncBodyEditor({ value, onValueChange, onKeyDown, placeholder }: Props) {
  const highlightRef = useRef<HTMLPreElement>(null);

  const highlightedHtml = useMemo(() => highlightJson(value), [value]);

  const syncScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    const layer = highlightRef.current;
    if (!layer) return;
    layer.scrollTop = e.currentTarget.scrollTop;
    layer.scrollLeft = e.currentTarget.scrollLeft;
  };

  return (
    <div className="jsonc-editor">
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
  );
}
