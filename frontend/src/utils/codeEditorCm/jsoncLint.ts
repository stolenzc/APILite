import { linter } from '@codemirror/lint';
import { parseJsonc } from '../jsonUtils';

export const jsoncCodeEditorLinter = linter((view) => {
  const text = view.state.doc.toString();
  if (!text.trim()) return [];
  const { valid } = parseJsonc(text, { ignoreEnvPlaceholders: true, allowTrailingComma: false });
  if (valid) return [];
  return [
    {
      from: 0,
      to: text.length,
      severity: 'error' as const,
      message: 'Invalid JSON',
    },
  ];
});
