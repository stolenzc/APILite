import { EditorView } from '@codemirror/view';

/**
 * Selection layer z-index. Colors are in index.css.
 * drawSelection() is added explicitly in the extensions array.
 */
export const codeEditorCmSelection = EditorView.theme({
  '.cm-selectionLayer': {
    zIndex: '2',
  },
});
