import { json } from '@codemirror/lang-json';
import { javascript } from '@codemirror/lang-javascript';
import { StreamLanguage } from '@codemirror/language';
import { shell } from '@codemirror/legacy-modes/mode/shell';

export type CodeEditorCmLanguage = 'json' | 'jsonc' | 'plain' | 'shell';

export function codeEditorCmLanguage(lang: CodeEditorCmLanguage) {
  switch (lang) {
    case 'json':
      return json();
    case 'jsonc':
      return javascript({ jsx: false, typescript: false });
    case 'shell':
      return StreamLanguage.define(shell);
    default:
      return [];
  }
}
