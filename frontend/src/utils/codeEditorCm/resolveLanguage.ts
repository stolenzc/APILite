import type { CodeEditorLanguage } from './types';
import type { CodeEditorCmLanguage } from './language';

export function resolveCodeEditorCmLanguage(
  language: CodeEditorLanguage,
  options: { editable: boolean; lintJsonc?: boolean },
): CodeEditorCmLanguage {
  if (language === 'curl') return 'shell';
  if (language === 'json') {
    return options.editable || options.lintJsonc ? 'jsonc' : 'json';
  }
  return 'plain';
}
