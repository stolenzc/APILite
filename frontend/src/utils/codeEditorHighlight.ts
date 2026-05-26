import { highlightCurl } from './curlHighlight';
import { highlightJson } from './jsonUtils';

/** Syntax mode for {@link highlightCode}; `json` covers strict JSON and JSONC. */
export type CodeEditorLanguage = 'plain' | 'json' | 'curl';

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function highlightCode(text: string, language: CodeEditorLanguage): string {
  if (!text) return '';
  switch (language) {
    case 'json':
      return highlightJson(text);
    case 'curl':
      return highlightCurl(text);
    default:
      return escapeHtml(text);
  }
}

/** CSS class on the highlight layer for token colors. */
export function syntaxHighlightClass(language: CodeEditorLanguage): string {
  if (language === 'curl') return 'curl-highlight';
  if (language === 'json') return 'json-highlight';
  return '';
}
