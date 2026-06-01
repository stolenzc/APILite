import { EditorView } from '@codemirror/view';

/**
 * CodeMirror chrome — uses app theme CSS variables.
 * Requires `theme="none"` on @uiw/react-codemirror to suppress its default light theme.
 */
export const codeEditorCmTheme = EditorView.theme(
  {
    '&': {
      height: '100%',
      backgroundColor: 'var(--code-editor-bg, var(--bg-input))',
      color: 'var(--text-primary)',
    },
    '&.cm-focused': {
      outline: 'none',
    },
    '.cm-scroller': {
      fontFamily: 'var(--font-mono)',
      fontSize: '12px',
      lineHeight: '18px',
      overflow: 'auto',
      backgroundColor: 'var(--code-editor-bg, var(--bg-input))',
      color: 'var(--text-primary)',
    },
    '.cm-content': {
      padding: '8px 12px',
      caretColor: 'var(--text-primary)',
      color: 'var(--text-primary)',
    },
    '.cm-line': {
      padding: '0',
    },
    '.cm-gutters': {
      backgroundColor: 'var(--code-editor-gutter-bg, var(--bg-secondary))',
      color: 'var(--text-muted)',
      borderRight: '1px solid var(--border-color)',
      fontSize: '12px',
    },
    '.cm-gutterElement': {
      padding: '0 8px 0 4px',
      minWidth: '2.5em',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'color-mix(in srgb, var(--accent) 14%, var(--code-editor-bg, var(--bg-input)))',
      color: 'var(--text-secondary)',
    },
    '.cm-activeLine': {
      backgroundColor: 'color-mix(in srgb, var(--accent) 10%, transparent)',
    },
    '.cm-cursor': {
      borderLeftColor: 'var(--text-primary)',
      borderLeftWidth: '2px',
    },
    '.cm-placeholder': {
      color: 'var(--text-muted)',
      fontStyle: 'italic',
    },
    '.cm-foldPlaceholder': {
      backgroundColor: 'var(--bg-tertiary)',
      color: 'var(--text-muted)',
      border: 'none',
    },
    '.cm-matchingBracket, .cm-nonmatchingBracket': {
      backgroundColor: 'color-mix(in srgb, var(--accent) 22%, transparent)',
      outline: '1px solid var(--accent)',
    },
    '.cm-lintRange-error': {
      backgroundImage: 'none',
      backgroundColor: 'color-mix(in srgb, var(--error) 18%, transparent)',
    },
    '.cm-diagnostic-error': {
      color: 'var(--error)',
    },
    '.cm-tooltip': {
      backgroundColor: 'var(--bg-secondary)',
      border: '1px solid var(--border-color)',
      color: 'var(--text-primary)',
    },
    '.cm-tooltip-autocomplete': {
      backgroundColor: 'var(--bg-secondary)',
      border: '1px solid var(--border-color)',
    },
    '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
      backgroundColor: 'var(--bg-input)',
      color: 'var(--text-primary)',
    },
  },
  { dark: true },
);
