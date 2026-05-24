import * as jsonc from 'jsonc-parser';

export function parseJsonc(input: string): { value: unknown; valid: boolean } {
  const errors: jsonc.ParseError[] = [];
  const value = jsonc.parse(input, errors, { allowTrailingComma: true });
  return { value, valid: errors.length === 0 };
}

/** True when input is valid JSONC (comments and trailing commas allowed). */
export function isJsonc(input: string): boolean {
  if (!input.trim()) return false;
  return parseJsonc(input).valid;
}

export function formatJsonc(input: string): { formatted: string; valid: boolean } {
  const { value, valid } = parseJsonc(input);
  if (!valid) return { formatted: input, valid: false };
  return { formatted: JSON.stringify(value, null, 2), valid: true };
}

/** Strip JSONC to strict JSON for outbound HTTP (comments removed). Invalid input returned as-is. */
export function jsoncToStrictJson(input: string): string {
  const { value, valid } = parseJsonc(input);
  if (!valid) return input;
  return JSON.stringify(value);
}

export function formatJson(input: string): { formatted: string; valid: boolean } {
  try {
    const parsed = JSON.parse(input);
    return { formatted: JSON.stringify(parsed, null, 2), valid: true };
  } catch {
    return { formatted: input, valid: false };
  }
}

export function isJson(input: string): boolean {
  try {
    JSON.parse(input);
    return true;
  } catch {
    return false;
  }
}

// Simple regex-based JSON syntax highlighter
// Returns HTML-like string with <span class="json-*"> wrappers
// Groups: 1=key, 2=colon ws, 3=string, 4=bool/null, 5=number, 6=punctuation
const JSON_TOKEN_RE = /("(?:\\.|[^"\\])*")(\s*:\s*)|("(?:\\.|[^"\\])*")|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|([{}[\],])/g;

const JSONC_COMMENT_RE = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)/g;

export function highlightJson(input: string): string {
  const escaped = input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const withComments = escaped.replace(JSONC_COMMENT_RE, (comment) => {
    return `<span class="json-comment">${comment}</span>`;
  });

  return withComments.replace(JSON_TOKEN_RE, (match, key, colon, stringVal, bool, number, punct) => {
    if (key !== undefined) return `<span class="json-key">${key}</span>${colon}`;
    if (stringVal !== undefined) return `<span class="json-string">${stringVal}</span>`;
    if (bool !== undefined) return `<span class="json-bool">${bool}</span>`;
    if (number !== undefined) return `<span class="json-number">${number}</span>`;
    if (punct !== undefined) return `<span class="json-punct">${punct}</span>`;
    return match;
  });
}
