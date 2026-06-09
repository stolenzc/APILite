import { json } from '@codemirror/lang-json';
import { jsonc, jsoncLanguage } from '@shopify/lang-jsonc';
import { StreamLanguage } from '@codemirror/language';
import { shell } from '@codemirror/legacy-modes/mode/shell';
import { EditorState } from '@codemirror/state';
import type { Extension } from '@codemirror/state';

export type CodeEditorCmLanguage = 'json' | 'jsonc' | 'plain' | 'shell';

/** JSONC line/block comment tokens for Cmd-/ toggle (not provided by @shopify/lang-jsonc). */
const jsoncCommentTokens = {
  line: '//',
  block: { open: '/*', close: '*/' },
} as const;

/** Fallback comment tokens for plain-text editors (raw text/javascript/xml, etc.). */
const plainCommentTokens = EditorState.languageData.of(() => [
  { commentTokens: jsoncCommentTokens },
]);

export function codeEditorCmLanguage(lang: CodeEditorCmLanguage): Extension[] {
  switch (lang) {
    case 'json':
      return [json()];
    case 'jsonc':
      return [
        jsonc(),
        jsoncLanguage.data.of({ commentTokens: jsoncCommentTokens }),
      ];
    case 'shell':
      return [StreamLanguage.define(shell)];
    default:
      return [plainCommentTokens];
  }
}
