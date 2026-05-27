import { useCallback, useEffect, useMemo, useRef } from 'react';
import { EnvVarField } from './EnvVarField';
import LineNumberGutter, { type LineNumberGutterHandle } from './LineNumberGutter';
import {
  highlightCode,
  syntaxHighlightClass,
  type CodeEditorLanguage,
} from '../utils/codeEditorHighlight';
import { splitLogicalLines } from '../utils/lineNumbers';

export type { CodeEditorLanguage };

export interface CodeEditorFeatures {
  lineNumbers?: boolean;
  highlight?: boolean;
  wordWrap?: boolean;
  /** Defaults to whether `onValueChange` is provided. */
  editable?: boolean;
  envVars?: boolean;
}

export interface CodeEditorProps {
  value: string;
  onValueChange?: (value: string) => void;
  language?: CodeEditorLanguage;
  features?: CodeEditorFeatures;
  placeholder?: string;
  className?: string;
  fill?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onFocus?: (e: React.FocusEvent<HTMLTextAreaElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLTextAreaElement>) => void;
  onSuggestOpenChange?: (open: boolean) => void;
  suggestListId?: string;
}

type ResolvedFeatures = Required<CodeEditorFeatures>;

function resolveFeatures(
  onValueChange: CodeEditorProps['onValueChange'],
  features?: CodeEditorFeatures,
): ResolvedFeatures {
  return {
    lineNumbers: features?.lineNumbers ?? false,
    highlight: features?.highlight ?? false,
    wordWrap: features?.wordWrap ?? false,
    editable: features?.editable ?? onValueChange !== undefined,
    envVars: features?.envVars ?? false,
  };
}

function isReadOnly(features: ResolvedFeatures, onValueChange?: (value: string) => void): boolean {
  return !features.editable || onValueChange === undefined;
}

function inputLayerClass(highlight: boolean): string {
  return `code-editor-input code-editor-layer${highlight ? ' code-editor-input--transparent' : ''}`;
}

function selectAllLineContent(stack: HTMLElement) {
  const cells = stack.querySelectorAll<HTMLElement>('.line-content-cell');
  if (cells.length === 0) return;
  const range = document.createRange();
  range.setStart(cells[0], 0);
  const last = cells[cells.length - 1];
  range.setEnd(last, last.childNodes.length);
  const sel = window.getSelection();
  if (!sel) return;
  sel.removeAllRanges();
  sel.addRange(range);
}

/** Read-only viewer: one row per logical line; gutter bg spans full scroll height. */
function CodeEditorLineGridView({
  value,
  language,
  highlight,
  wordWrap,
}: {
  value: string;
  language: CodeEditorLanguage;
  highlight: boolean;
  wordWrap: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const lines = useMemo(() => splitLogicalLines(value), [value]);
  const themeClass = syntaxHighlightClass(language);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'a') return;
    e.preventDefault();
    const stack = scrollRef.current?.querySelector<HTMLElement>('.line-sync-stack');
    if (stack) selectAllLineContent(stack);
  }, []);

  return (
    <div
      ref={scrollRef}
      className={`line-sync-scroll${wordWrap ? ' line-sync-scroll--wrap' : ''}`}
      tabIndex={0}
      role="region"
      aria-label="Code content"
      onKeyDown={handleKeyDown}
      onMouseDown={(e) => {
        if (e.button !== 0) return;
        scrollRef.current?.focus();
      }}
    >
      <div className="line-sync-stack">
        {lines.map((line, index) => (
          <div className="line-sync-row" key={index}>
            <div className="line-number-cell" aria-hidden>
              {index + 1}
            </div>
            <div className="line-content-cell">
              {highlight ? (
                <code
                  className={`line-content-highlight${themeClass ? ` ${themeClass}` : ''}`}
                  dangerouslySetInnerHTML={{ __html: highlightCode(line, language) }}
                />
              ) : (
                <span className="line-content-plain">{line || '\u00a0'}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CodeEditorInputView({
  value,
  onValueChange,
  language,
  features,
  placeholder,
  onKeyDown,
  onFocus,
  onBlur,
  onSuggestOpenChange,
  suggestListId,
}: {
  value: string;
  onValueChange?: (value: string) => void;
  language: CodeEditorLanguage;
  features: ResolvedFeatures;
  placeholder?: string;
  onKeyDown?: CodeEditorProps['onKeyDown'];
  onFocus?: CodeEditorProps['onFocus'];
  onBlur?: CodeEditorProps['onBlur'];
  onSuggestOpenChange?: CodeEditorProps['onSuggestOpenChange'];
  suggestListId?: string;
}) {
  const readOnly = isReadOnly(features, onValueChange);
  const highlightRef = useRef<HTMLPreElement>(null);
  const gutterRef = useRef<LineNumberGutterHandle>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const highlightedHtml = useMemo(
    () => (features.highlight ? highlightCode(value, language) : ''),
    [value, language, features.highlight],
  );

  const syncScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    const { scrollTop, scrollLeft } = e.currentTarget;
    const layer = highlightRef.current;
    if (layer) {
      layer.scrollTop = scrollTop;
      layer.scrollLeft = scrollLeft;
    }
    gutterRef.current?.syncScrollTop(scrollTop);
  };

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const onScroll = (e: Event) => {
      if (!(e.target instanceof HTMLTextAreaElement)) return;
      if (!root.contains(e.target)) return;
      const { scrollTop, scrollLeft } = e.target;
      const layer = highlightRef.current;
      if (layer) {
        layer.scrollTop = scrollTop;
        layer.scrollLeft = scrollLeft;
      }
      gutterRef.current?.syncScrollTop(scrollTop);
    };
    root.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => root.removeEventListener('scroll', onScroll, { capture: true });
  }, []);

  const inputClass = inputLayerClass(features.highlight);
  const wrapAttr = features.wordWrap ? 'soft' : 'off';
  const commonTextareaProps = {
    className: inputClass,
    value,
    readOnly,
    onKeyDown,
    onFocus,
    onBlur,
    onScroll: syncScroll,
    placeholder,
    spellCheck: false as const,
    autoCapitalize: 'off' as const,
    autoCorrect: 'off' as const,
    wrap: wrapAttr,
  };

  const editor =
    features.envVars && !readOnly ? (
      <EnvVarField
        as="textarea"
        {...commonTextareaProps}
        onValueChange={onValueChange!}
        onSuggestOpenChange={onSuggestOpenChange}
        suggestListId={suggestListId}
      />
    ) : (
      <textarea
        {...commonTextareaProps}
        onChange={readOnly ? undefined : (e) => onValueChange?.(e.target.value)}
      />
    );

  const themeClass = syntaxHighlightClass(language);
  const viewport = (
    <div className={`code-editor-viewport${features.wordWrap ? ' code-editor--wrap' : ''}`}>
      {features.highlight && (
        <pre
          ref={highlightRef}
          className={`code-editor-highlight code-editor-layer${themeClass ? ` ${themeClass}` : ''}`}
          aria-hidden
          dangerouslySetInnerHTML={{ __html: highlightedHtml }}
        />
      )}
      {features.highlight ? <div className="code-editor-input-wrap">{editor}</div> : editor}
    </div>
  );

  const rootClass = features.lineNumbers ? 'code-editor-with-gutter' : 'code-editor-input-root';

  return (
    <div ref={rootRef} className={rootClass}>
      {features.lineNumbers && (
        <LineNumberGutter ref={gutterRef} text={value} className="code-editor-gutter" />
      )}
      {viewport}
    </div>
  );
}

export default function CodeEditor({
  value,
  onValueChange,
  language = 'plain',
  features: featuresProp,
  placeholder,
  className,
  fill,
  onKeyDown,
  onFocus,
  onBlur,
  onSuggestOpenChange,
  suggestListId,
}: CodeEditorProps) {
  const features = resolveFeatures(onValueChange, featuresProp);
  const readOnly = isReadOnly(features, onValueChange);

  const rootClass = ['code-editor', fill && 'code-editor--fill', className]
    .filter(Boolean)
    .join(' ');

  if (readOnly) {
    return (
      <div className={rootClass}>
        <CodeEditorLineGridView
          value={value}
          language={language}
          highlight={features.highlight}
          wordWrap={features.wordWrap}
        />
      </div>
    );
  }

  return (
    <div className={rootClass}>
      <CodeEditorInputView
        value={value}
        onValueChange={onValueChange}
        language={language}
        features={features}
        placeholder={placeholder}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        onBlur={onBlur}
        onSuggestOpenChange={onSuggestOpenChange}
        suggestListId={suggestListId}
      />
    </div>
  );
}
