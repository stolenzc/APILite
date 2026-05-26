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

/** JSON object/array only — bare numbers/strings are valid JSON but must not be parsed as Number. */
function isJsonObjectOrArray(input: string): boolean {
  const t = input.trim();
  return t.startsWith('{') || t.startsWith('[');
}

/** Number literals outside JSON strings; used to detect JSON.parse precision loss. */
function extractJsonNumberLiterals(input: string): string[] {
  const result: string[] = [];
  let i = 0;
  let inString = false;
  while (i < input.length) {
    const ch = input[i];
    if (inString) {
      if (ch === '\\') {
        i += 2;
        continue;
      }
      if (ch === '"') inString = false;
      i++;
      continue;
    }
    if (ch === '"') {
      inString = true;
      i++;
      continue;
    }
    if (ch === '-' || (ch >= '0' && ch <= '9')) {
      const start = i;
      if (ch === '-') i++;
      while (i < input.length && input[i] >= '0' && input[i] <= '9') i++;
      if (i < input.length && input[i] === '.') {
        i++;
        while (i < input.length && input[i] >= '0' && input[i] <= '9') i++;
      }
      if (i < input.length && (input[i] === 'e' || input[i] === 'E')) {
        i++;
        if (i < input.length && (input[i] === '+' || input[i] === '-')) i++;
        while (i < input.length && input[i] >= '0' && input[i] <= '9') i++;
      }
      result.push(input.slice(start, i));
      continue;
    }
    i++;
  }
  return result;
}

function jsonNumberLiteralsPreserveOnParse(input: string): boolean {
  const literals = extractJsonNumberLiterals(input);
  if (literals.length === 0) return true;
  try {
    const compact = JSON.stringify(JSON.parse(input));
    const outLiterals = extractJsonNumberLiterals(compact);
    if (literals.length !== outLiterals.length) return false;
    return literals.every((lit, idx) => lit === outLiterals[idx]);
  } catch {
    return true;
  }
}

export function formatJson(input: string): { formatted: string; valid: boolean } {
  if (!isJsonObjectOrArray(input)) {
    return { formatted: input, valid: false };
  }
  try {
    if (!jsonNumberLiteralsPreserveOnParse(input)) {
      return { formatted: input, valid: true };
    }
    const parsed = JSON.parse(input);
    return { formatted: JSON.stringify(parsed, null, 2), valid: true };
  } catch {
    return { formatted: input, valid: false };
  }
}

export function isJson(input: string): boolean {
  if (!isJsonObjectOrArray(input)) return false;
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

/** Letter-only slug — digits in placeholders get wrapped by JSON_TOKEN_RE and break HTML comments. */
const COMMENT_PH_RE = /<!--APILITEC([a-z]+)-->/g;

function commentIndexSlug(n: number): string {
  let s = '';
  let v = n + 1;
  while (v > 0) {
    v -= 1;
    s = String.fromCharCode(97 + (v % 26)) + s;
    v = Math.floor(v / 26);
  }
  return s;
}

function slugToCommentIndex(slug: string): number {
  let n = 0;
  for (const ch of slug) {
    n = n * 26 + (ch.charCodeAt(0) - 97 + 1);
  }
  return n - 1;
}

function commentPlaceholder(idx: number): string {
  return `<!--APILITEC${commentIndexSlug(idx)}-->`;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function highlightJson(input: string): string {
  const escaped = escapeHtml(input);
  const commentSlots: string[] = [];

  const withoutComments = escaped.replace(JSONC_COMMENT_RE, (comment) => {
    const idx = commentSlots.length;
    commentSlots.push(comment);
    return commentPlaceholder(idx);
  });

  const withTokens = withoutComments.replace(
    JSON_TOKEN_RE,
    (match, key, colon, stringVal, bool, number, punct) => {
      if (key !== undefined) return `<span class="json-key">${key}</span>${colon}`;
      if (stringVal !== undefined) return `<span class="json-string">${stringVal}</span>`;
      if (bool !== undefined) return `<span class="json-bool">${bool}</span>`;
      if (number !== undefined) return `<span class="json-number">${number}</span>`;
      if (punct !== undefined) return `<span class="json-punct">${punct}</span>`;
      return match;
    },
  );

  return withTokens.replace(COMMENT_PH_RE, (_, slug) => {
    const comment = commentSlots[slugToCommentIndex(slug)] ?? '';
    return `<span class="json-comment">${comment}</span>`;
  });
}
