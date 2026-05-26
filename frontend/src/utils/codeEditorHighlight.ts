import { highlightCurl } from './curlHighlight';
import { highlightJson } from './jsonUtils';

export type CodeEditorLanguage = 'plain' | 'json' | 'jsonc' | 'curl';

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
    case 'jsonc':
      return highlightJson(text);
    case 'curl':
      return highlightCurl(text);
    default:
      return escapeHtml(text);
  }
}
