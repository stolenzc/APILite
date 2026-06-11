import { linter } from '@codemirror/lint';
import { getMergedInterpolationVars } from '../interpolationVars';
import { parseJsonc } from '../jsonUtils';

export function createJsoncCodeEditorLinter(getEnvVars: () => Record<string, string> = getMergedInterpolationVars) {
  return linter((view) => {
    const text = view.state.doc.toString();
    if (!text.trim()) return [];
    const { valid } = parseJsonc(text, {
      ignoreEnvPlaceholders: true,
      allowTrailingComma: false,
      envVars: getEnvVars(),
    });
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
}

/** Default JSONC linter; reads current env/script vars on each lint pass. */
export const jsoncCodeEditorLinter = createJsoncCodeEditorLinter();
