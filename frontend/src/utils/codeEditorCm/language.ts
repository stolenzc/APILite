import { json } from '@codemirror/lang-json';
import { jsonc } from '@shopify/lang-jsonc';
import { StreamLanguage } from '@codemirror/language';
import { shell } from '@codemirror/legacy-modes/mode/shell';

export type CodeEditorCmLanguage = 'json' | 'jsonc' | 'plain' | 'shell';

export function codeEditorCmLanguage(lang: CodeEditorCmLanguage) {
  switch (lang) {
    case 'json':
      return json();
    case 'jsonc':
      return jsonc();
    case 'shell':
      return StreamLanguage.define(shell);
    default:
      return [];
  }
}
