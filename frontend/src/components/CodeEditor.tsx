import { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import CodeMirror from '@uiw/react-codemirror';
import type { ViewUpdate } from '@codemirror/view';
import { EditorView, keymap } from '@codemirror/view';
import { closeBrackets } from '@codemirror/autocomplete';
import { lintGutter } from '@codemirror/lint';
import { search, searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import type { EditorView as EditorViewType } from '@codemirror/view';
import EnvVarSuggestList from './EnvVarSuggestList';
import { useEnvVarCodeMirrorSuggest } from '../hooks/useEnvVarCodeMirrorSuggest';
import { useEnvVarCodeMirrorSuggestStyle } from '../hooks/useEnvVarCodeMirrorSuggestStyle';
import { useInterpolationVarsSignature } from '../utils/interpolationVars';
import { codeEditorCmHighlight } from '../utils/codeEditorCm/highlight';
import { codeEditorCmLanguage } from '../utils/codeEditorCm/language';
import { createJsoncCodeEditorLinter } from '../utils/codeEditorCm/jsoncLint';
import { resolveCodeEditorCmLanguage } from '../utils/codeEditorCm/resolveLanguage';
import { codeEditorCmSelection } from '../utils/codeEditorCm/selection';
import { codeEditorCmTheme } from '../utils/codeEditorCm/theme';
import type { CodeEditorLanguage, CodeEditorVariant } from '../utils/codeEditorCm/types';
import type { EditorKeyEvent } from '../utils/keyboard';

export type { CodeEditorLanguage, CodeEditorVariant };

export interface CodeEditorFeatures {
  wordWrap?: boolean;
  /** Code folding gutter; default on for JSON/JSONC. */
  foldGutter?: boolean;
  envVars?: boolean;
  lintJsonc?: boolean;
  editable?: boolean;
  /** Enable find/replace (Cmd/Ctrl+F, Cmd/Ctrl+H). Default on for editable editors. */
  search?: boolean;
}

export interface CodeEditorProps {
  value: string;
  onValueChange?: (value: string) => void;
  language?: CodeEditorLanguage;
  variant?: CodeEditorVariant;
  features?: CodeEditorFeatures;
  placeholder?: string;
  className?: string;
  fill?: boolean;
  onKeyDown?: (e: EditorKeyEvent) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onSuggestOpenChange?: (open: boolean) => void;
  suggestListId?: string;
}

type ResolvedFeatures = {
  wordWrap: boolean;
  foldGutter?: boolean;
  envVars: boolean;
  lintJsonc: boolean;
  editable: boolean;
  search: boolean;
};

function resolveFeatures(
  onValueChange: CodeEditorProps['onValueChange'],
  features?: CodeEditorFeatures,
): ResolvedFeatures {
  const editable = features?.editable ?? onValueChange !== undefined;
  return {
    wordWrap: features?.wordWrap ?? false,
    foldGutter: features?.foldGutter,
    envVars: features?.envVars ?? false,
    lintJsonc: features?.lintJsonc ?? false,
    editable,
    search: features?.search ?? editable,
  };
}

function useCodeEditorSetup(
  language: CodeEditorLanguage,
  variant: CodeEditorVariant,
  features: ResolvedFeatures,
  readOnly: boolean,
  className: string | undefined,
  fill: boolean | undefined,
  interpolationVarsSig: string,
) {
  const cmLanguage = resolveCodeEditorCmLanguage(language, {
    editable: features.editable,
    lintJsonc: features.lintJsonc,
  });

  const jsoncLinter = useMemo(
    () => (features.lintJsonc ? createJsoncCodeEditorLinter() : null),
    [features.lintJsonc, interpolationVarsSig],
  );

  const extensions = useMemo(() => {
    const exts: import('@codemirror/state').Extension[] = [
      codeEditorCmTheme,
      codeEditorCmSelection,
      codeEditorCmHighlight,
      ...codeEditorCmLanguage(cmLanguage),
    ];
    if (!readOnly) {
      exts.push(closeBrackets());
    } else {
      exts.push(
        EditorView.editable.of(false),
        // When CodeMirror is not editable, the inner content can become unfocusable via click.
        // Make it focusable so keyboard shortcuts (Cmd/Ctrl+A, find, etc.) work inside read-only views.
        EditorView.contentAttributes.of({ 'aria-readonly': 'true', tabindex: '0' }),
        EditorView.domEventHandlers({
          mousedown(_e, view) {
            if (!view.hasFocus) view.focus();
            return false;
          },
        }),
      );
    }
    if (features.wordWrap) {
      exts.push(EditorView.lineWrapping);
    }
    if (jsoncLinter && !readOnly) {
      exts.push(jsoncLinter, lintGutter());
    }
    if (features.search && !readOnly) {
      exts.push(
        search(),
        keymap.of(searchKeymap),
        highlightSelectionMatches(),
      );
    }
    return exts;
  }, [
    cmLanguage,
    readOnly,
    features.wordWrap,
    jsoncLinter,
    features.foldGutter,
    features.search,
  ]);

  const rootClass = [
    'code-editor',
    'code-editor--cm',
    variant === 'surface' ? 'code-editor--surface' : 'code-editor--field',
    fill && 'code-editor--fill',
    readOnly && 'code-editor--readonly',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return { extensions, rootClass };
}

type CodeMirrorShellProps = {
  value: string;
  onValueChange?: (value: string) => void;
  readOnly: boolean;
  placeholder?: string;
  extensions: import('@codemirror/state').Extension[];
  rootClass: string;
  viewRef: React.RefObject<EditorViewType | null>;
  onKeyDown?: (e: EditorKeyEvent) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onUpdate?: (vu: ViewUpdate) => void;
};

function CodeMirrorShell({
  value,
  onValueChange,
  readOnly,
  placeholder,
  extensions,
  rootClass,
  viewRef,
  onKeyDown,
  onFocus,
  onBlur,
  onUpdate,
}: CodeMirrorShellProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const id = requestAnimationFrame(() => {
      view.requestMeasure();
    });
    return () => cancelAnimationFrame(id);
  }, [value, extensions, viewRef]);

  useEffect(() => () => resizeObserverRef.current?.disconnect(), []);

  return (
    <div
      ref={containerRef}
      className={rootClass}
    >
    <CodeMirror
      value={value}
      className="code-editor--cm-inner"
      theme="none"
      placeholder={placeholder}
      extensions={extensions}
      readOnly={readOnly}
      height="100%"
      basicSetup={{
        drawSelection: false,
        lineNumbers: true,
        highlightActiveLineGutter: !readOnly,
        highlightActiveLine: !readOnly,
        tabSize: 2,
      }}
      indentWithTab
      onCreateEditor={(view) => {
        viewRef.current = view;
        const el = containerRef.current;
        resizeObserverRef.current?.disconnect();
        if (el) {
          const ro = new ResizeObserver(() => view.requestMeasure());
          ro.observe(el);
          resizeObserverRef.current = ro;
        }
        requestAnimationFrame(() => view.requestMeasure());
      }}
      onChange={(next) => {
        if (!readOnly) onValueChange?.(next);
      }}
      onUpdate={(vu) => {
        viewRef.current = vu.view;
        onUpdate?.(vu);
      }}
      onKeyDown={(e) => onKeyDown?.(e)}
      onFocus={onFocus}
      onBlur={onBlur}
    />
    </div>
  );
}

function CodeEditorWithEnv(props: CodeEditorProps & { features: ResolvedFeatures }) {
  const {
    value,
    onValueChange,
    features,
    onKeyDown,
    onFocus,
    onBlur,
    onSuggestOpenChange,
    suggestListId,
    language = 'plain',
    variant = 'field',
    className,
    fill,
    placeholder,
  } = props;

  const viewRef = useRef<EditorViewType | null>(null);
  const onChange = onValueChange ?? (() => {});
  const suggest = useEnvVarCodeMirrorSuggest(value, onChange, viewRef);
  const floatStyle = useEnvVarCodeMirrorSuggestStyle(suggest.isOpen, viewRef, suggest.caretIndex);
  const interpolationVarsSig = useInterpolationVarsSignature();
  const readOnly = !features.editable || onValueChange === undefined;
  const { extensions, rootClass } = useCodeEditorSetup(
    language,
    variant,
    features,
    readOnly,
    className,
    fill,
    interpolationVarsSig,
  );

  useEffect(() => {
    onSuggestOpenChange?.(suggest.isOpen);
  }, [suggest.isOpen, onSuggestOpenChange]);

  return (
    <>
      <CodeMirrorShell
        value={value}
        onValueChange={onValueChange}
        readOnly={readOnly}
        placeholder={placeholder}
        extensions={extensions}
        rootClass={rootClass}
        viewRef={viewRef}
        onKeyDown={(e) => {
          if (suggest.handleEnvKeyDown(e)) return;
          onKeyDown?.(e);
        }}
        onFocus={() => {
          const view = viewRef.current;
          if (view) {
            suggest.syncEnvSuggest(
              view.state.doc.toString(),
              view.state.selection.main.head,
            );
          }
          onFocus?.();
        }}
        onBlur={() => {
          window.setTimeout(() => suggest.closeSuggest(), 120);
          onBlur?.();
        }}
        onUpdate={(vu) => {
          if (!vu.docChanged && !vu.selectionSet) return;
          suggest.syncEnvSuggest(vu.state.doc.toString(), vu.state.selection.main.head);
        }}
      />
      {suggest.isOpen &&
        suggest.envSuggest &&
        createPortal(
          <EnvVarSuggestList
            id={suggestListId}
            suggest={suggest.envSuggest}
            activeIndex={suggest.envSuggestIndex}
            onActiveIndexChange={suggest.setEnvSuggestIndex}
            onPick={suggest.applyEnvSuggestion}
            className="env-var-suggest env-var-suggest--float"
            style={floatStyle}
          />,
          document.body,
        )}
    </>
  );
}

export default function CodeEditor({
  value,
  onValueChange,
  language = 'plain',
  variant = 'field',
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

  // Hooks must be called unconditionally (before any early return).
  const viewRef = useRef<EditorViewType | null>(null);
  const interpolationVarsSig = useInterpolationVarsSignature();
  const readOnly = !features.editable || onValueChange === undefined;
  const { extensions, rootClass } = useCodeEditorSetup(
    language,
    variant,
    features,
    readOnly,
    className,
    fill,
    interpolationVarsSig,
  );

  if (features.envVars) {
    return (
      <CodeEditorWithEnv
        value={value}
        onValueChange={onValueChange}
        language={language}
        variant={variant}
        features={features}
        placeholder={placeholder}
        className={className}
        fill={fill}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        onBlur={onBlur}
        onSuggestOpenChange={onSuggestOpenChange}
        suggestListId={suggestListId}
      />
    );
  }

  return (
    <CodeMirrorShell
      value={value}
      onValueChange={onValueChange}
      readOnly={readOnly}
      placeholder={placeholder}
      extensions={extensions}
      rootClass={rootClass}
      viewRef={viewRef}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      onBlur={onBlur}
    />
  );
}
