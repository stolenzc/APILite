import { Fragment, useEffect, useMemo, useRef, type TextareaHTMLAttributes } from 'react';
import { EnvVarField } from './EnvVarField';
import LineNumberGutter, { type LineNumberGutterHandle } from './LineNumberGutter';
import {
  highlightCode,
  type CodeEditorLanguage,
} from '../utils/codeEditorHighlight';
import { splitLogicalLines } from '../utils/lineNumbers';

export type { CodeEditorLanguage };

export interface CodeEditorFeatures {
  lineNumbers?: boolean;
  highlight?: boolean;
  wordWrap?: boolean;
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

function mergeFeatures(
  onValueChange: CodeEditorProps['onValueChange'],
  features?: CodeEditorFeatures,
): Required<CodeEditorFeatures> {
  const editableDefault = onValueChange !== undefined;
  return {
    lineNumbers: features?.lineNumbers ?? false,
    highlight: features?.highlight ?? false,
    wordWrap: features?.wordWrap ?? false,
    editable: features?.editable ?? editableDefault,
    envVars: features?.envVars ?? false,
  };
}

function highlightClassName(language: CodeEditorLanguage): string {
  if (language === 'curl') return 'curl-highlight';
  if (language === 'json' || language === 'jsonc') return 'json-highlight';
  return '';
}

/** Read-only + word-wrap: per-line grid so line numbers track wrapped rows. */
function CodeEditorWrappedReadonly({
  value,
  language,
  highlight,
  className,
}: {
  value: string;
  language: CodeEditorLanguage;
  highlight: boolean;
  className?: string;
}) {
  const lines = useMemo(() => splitLogicalLines(value), [value]);

  return (
    <div
      className={`line-sync-scroll line-sync-scroll--wrap${className ? ` ${className}` : ''}`}
    >
      <div className="line-sync-stack">
        {lines.map((line, index) => (
          <Fragment key={index}>
            <div className="line-number-cell">{index + 1}</div>
            <div className="line-content-cell">
              {highlight ? (
                <code
                  className={`json-highlight line-content-highlight${language === 'curl' ? ' curl-highlight' : ''}`}
                  dangerouslySetInnerHTML={{ __html: highlightCode(line, language) }}
                />
              ) : (
                <span className="line-content-plain">{line || '\u00a0'}</span>
              )}
            </div>
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function CodeEditorOverlay({
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
  features: Required<CodeEditorFeatures>;
  placeholder?: string;
  onKeyDown?: CodeEditorProps['onKeyDown'];
  onFocus?: CodeEditorProps['onFocus'];
  onBlur?: CodeEditorProps['onBlur'];
  onSuggestOpenChange?: CodeEditorProps['onSuggestOpenChange'];
  suggestListId?: string;
}) {
  const readOnly = !features.editable || !onValueChange;
  const highlightRef = useRef<HTMLPreElement>(null);
  const gutterRef = useRef<LineNumberGutterHandle>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const highlightedHtml = useMemo(
    () => (features.highlight ? highlightCode(value, language) : ''),
    [value, language, features.highlight],
  );

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
    const root = rootRef.current;
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

  const wrapClass = features.wordWrap ? ' code-editor--wrap' : '';
  const hlClass = highlightClassName(language);

  const textareaProps: TextareaHTMLAttributes<HTMLTextAreaElement> = {
    className: `code-editor-input code-editor-layer${features.highlight ? ' code-editor-input--transparent' : ''}`,
    value,
    readOnly,
    onChange: readOnly
      ? undefined
      : (e) => onValueChange?.(e.target.value),
    onKeyDown,
    onFocus,
    onBlur,
    onScroll: syncScroll,
    placeholder,
    spellCheck: false,
    autoCapitalize: 'off',
    autoCorrect: 'off',
    wrap: features.wordWrap ? 'soft' : 'off',
  };

  const inputClassName = textareaProps.className ?? 'code-editor-input code-editor-layer';

  const editor = features.envVars && !readOnly ? (
    <EnvVarField
      as="textarea"
      className={inputClassName}
      value={value}
      onValueChange={onValueChange!}
      readOnly={readOnly}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      onBlur={onBlur}
      onScroll={syncScroll}
      placeholder={placeholder}
      spellCheck={false}
      autoCapitalize="off"
      autoCorrect="off"
      wrap={features.wordWrap ? 'soft' : 'off'}
      onSuggestOpenChange={onSuggestOpenChange}
      suggestListId={suggestListId}
    />
  ) : (
    <textarea {...textareaProps} />
  );

  const viewport = (
    <div className={`code-editor-viewport${wrapClass}`}>
      {features.highlight && (
        <pre
          ref={highlightRef}
          className={`code-editor-highlight code-editor-layer${hlClass ? ` ${hlClass}` : ''}`}
          aria-hidden
          dangerouslySetInnerHTML={{ __html: highlightedHtml }}
        />
      )}
      {features.highlight ? (
        <div className="code-editor-input-wrap">{editor}</div>
      ) : (
        editor
      )}
    </div>
  );

  if (!features.lineNumbers) {
    return (
      <div ref={rootRef} className="code-editor-overlay">
        {viewport}
      </div>
    );
  }

  return (
    <div ref={rootRef} className="code-editor-with-gutter">
      <LineNumberGutter ref={gutterRef} text={value} className="code-editor-gutter" />
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
  const features = mergeFeatures(onValueChange, featuresProp);
  const readOnly = !features.editable || !onValueChange;

  const rootClass = [
    'code-editor',
    fill ? 'code-editor--fill' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  if (readOnly && features.wordWrap) {
    return (
      <div className={rootClass}>
        <CodeEditorWrappedReadonly
          value={value}
          language={language}
          highlight={features.highlight}
        />
      </div>
    );
  }

  return (
    <div className={rootClass}>
      <CodeEditorOverlay
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
