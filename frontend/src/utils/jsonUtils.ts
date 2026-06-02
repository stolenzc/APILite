import * as jsonc from 'jsonc-parser';

/** `{{var}}` placeholders — stripped only for JSONC validation, not for send/minify. */
const ENV_PLACEHOLDER = /\{\{\s*[^}]*?\s*\}\}/g;

export type ParseJsoncOptions = {
  /** Treat `{{name}}` as empty for validity checks (body editor / linter). */
  ignoreEnvPlaceholders?: boolean;
  /** Allow trailing commas like JSONC (default true). */
  allowTrailingComma?: boolean;
};

export function stripEnvPlaceholdersForJsonc(input: string): string {
  return input.replace(ENV_PLACEHOLDER, '');
}

function jsoncTextForParse(input: string, options?: ParseJsoncOptions): string {
  return options?.ignoreEnvPlaceholders ? stripEnvPlaceholdersForJsonc(input) : input;
}

export function parseJsonc(
  input: string,
  options?: ParseJsoncOptions,
): { value: unknown; valid: boolean } {
  const text = jsoncTextForParse(input, options);
  const errors: jsonc.ParseError[] = [];
  const value = jsonc.parse(text, errors, { allowTrailingComma: options?.allowTrailingComma ?? true });
  return { value, valid: errors.length === 0 };
}

/** True when input is valid JSONC (comments and trailing commas allowed). */
export function isJsonc(input: string, options?: ParseJsoncOptions): boolean {
  if (!input.trim()) return false;
  return parseJsonc(input, { ignoreEnvPlaceholders: true, ...options }).valid;
}

/** Remove JSONC comments outside of string literals. */
function stripJsoncComments(input: string): string {
  let out = '';
  let i = 0;
  let inString = false;

  while (i < input.length) {
    const ch = input[i];
    if (inString) {
      if (ch === '\\') {
        out += input.slice(i, i + 2);
        i += 2;
        continue;
      }
      if (ch === '"') inString = false;
      out += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      i++;
      continue;
    }
    if (ch === '/' && input[i + 1] === '/') {
      i += 2;
      while (i < input.length && input[i] !== '\n') i++;
      continue;
    }
    if (ch === '/' && input[i + 1] === '*') {
      i += 2;
      while (i < input.length && !(input[i] === '*' && input[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    out += ch;
    i++;
  }

  return out;
}

/** Format JSONC while keeping comments at their nearest structural position. */
export function formatJsonc(input: string): { formatted: string; valid: boolean } {
  if (!input.trim()) return { formatted: input, valid: false };
  const { valid } = parseJsonc(input, { ignoreEnvPlaceholders: true });
  if (!valid) return { formatted: input, valid: false };

  const segments = splitJsoncSegments(input);

  // Classify each comment as inline or standalone.
  type CommentInfo = {
    inline: boolean;
    anchor: string; // trimmed code line the comment is anchored to
    text: string;
  };
  const comments: CommentInfo[] = [];
  let codeLine = 0;
  let codeLineContent = '';
  let codeLineHasContent = false;

  for (const seg of segments) {
    if (seg.type === 'comment') {
      comments.push({
        inline: codeLineHasContent,
        anchor: codeLineContent.trim(),
        text: seg.text,
      });
    } else {
      for (let i = 0; i < seg.text.length; i++) {
        const ch = seg.text[i];
        if (ch === '\n') {
          codeLine++;
          codeLineContent = '';
          codeLineHasContent = false;
        } else {
          codeLineContent += ch;
          if (ch !== ' ' && ch !== '\t' && ch !== '\r') {
            codeLineHasContent = true;
          }
        }
      }
    }
  }

  const codeOnly = segments
    .filter((seg): seg is JsoncSegment & { type: 'code' } => seg.type === 'code')
    .map((seg) => seg.text)
    .join('');
  const trimmed = codeOnly.trim();
  if (!trimmed) return { formatted: input, valid: false };

  const { formatted, valid: fmtOk } = formatJson(trimmed);
  if (!fmtOk) return { formatted: input, valid: false };
  if (comments.length === 0) return { formatted, valid: true };

  const lines = formatted.split('\n');

  // Find the formatted line that contains a given anchor substring.
  const findLine = (anchor: string): number => {
    if (!anchor) return -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(anchor)) return i;
    }
    return -1;
  };

  // Insert in reverse order so indices don't shift.
  const sorted = [...comments].sort((a, b) => {
    const ai = findLine(a.anchor);
    const bi = findLine(b.anchor);
    return bi - ai || (b.inline ? 1 : 0) - (a.inline ? 1 : 0);
  });

  for (const comment of sorted) {
    const commentText = comment.text.replace(/\n$/, '');
    if (comment.inline && comment.anchor) {
      // Inline: append to the same formatted line.
      const li = findLine(comment.anchor);
      if (li >= 0) {
        lines[li] = lines[li] + '  ' + commentText;
        continue;
      }
    }
    // Standalone: insert before the next code line.
    const li = findLine(comment.anchor);
    const insertAt = li >= 0 ? li : lines.length;
    lines.splice(insertAt, 0, commentText);
  }

  return { formatted: lines.join('\n'), valid: true };
}

/** Compact JSONC to strict JSON (comments stripped, large integers preserved). */
export function jsoncToStrictJson(input: string): string {
  if (!input.trim()) return input;
  const { valid } = parseJsonc(input);
  if (!valid) return input;
  const tokens = parseJsonTokens(stripJsoncComments(input).trim());
  if (!tokens) return input;
  return minifyJsonTokens(tokens);
}

function minifyJsonTokens(tokens: JsonToken[]): string {
  return tokens.map((t) => tokenForDisplay(t)).join('');
}

type JsonToken =
  | { kind: 'punct'; value: string }
  | { kind: 'string'; value: string }
  | { kind: 'number'; value: string }
  | { kind: 'literal'; value: string };

function tokenText(token: JsonToken): string {
  return token.value;
}

/**
 * Decode JSON string token escapes (`\uXXXX`, `\n`, surrogate pairs) to UTF-16/UTF-8 text.
 * Number tokens are never passed here — large integers stay verbatim.
 */
function decodeJsonStringToken(quoted: string): string {
  try {
    const decoded = JSON.parse(quoted) as unknown;
    if (typeof decoded !== 'string') return quoted;
    return JSON.stringify(decoded);
  } catch {
    return quoted;
  }
}

function tokenForDisplay(token: JsonToken): string {
  if (token.kind === 'string') return decodeJsonStringToken(token.value);
  return tokenText(token);
}

/** Tokenize JSON without converting numbers (preserves large integer literals). */
function tokenizeJson(input: string): JsonToken[] | null {
  const tokens: JsonToken[] = [];
  let i = 0;

  while (i < input.length) {
    const ch = input[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if ('{}[]:,'.includes(ch)) {
      tokens.push({ kind: 'punct', value: ch });
      i++;
      continue;
    }
    if (ch === '"') {
      const start = i;
      i++;
      while (i < input.length) {
        if (input[i] === '\\') {
          i += 2;
          if (i > input.length) return null;
          continue;
        }
        if (input[i] === '"') {
          i++;
          break;
        }
        i++;
      }
      if (i > input.length || input[i - 1] !== '"') return null;
      tokens.push({ kind: 'string', value: input.slice(start, i) });
      continue;
    }
    if (ch === '-' || (ch >= '0' && ch <= '9')) {
      const start = i;
      if (ch === '-') i++;
      if (i >= input.length) return null;
      if (input[i] === '0') {
        i++;
      } else if (input[i] >= '1' && input[i] <= '9') {
        while (i < input.length && input[i] >= '0' && input[i] <= '9') i++;
      } else {
        return null;
      }
      if (i < input.length && input[i] === '.') {
        i++;
        if (i >= input.length || input[i] < '0' || input[i] > '9') return null;
        while (i < input.length && input[i] >= '0' && input[i] <= '9') i++;
      }
      if (i < input.length && (input[i] === 'e' || input[i] === 'E')) {
        i++;
        if (i < input.length && (input[i] === '+' || input[i] === '-')) i++;
        if (i >= input.length || input[i] < '0' || input[i] > '9') return null;
        while (i < input.length && input[i] >= '0' && input[i] <= '9') i++;
      }
      tokens.push({ kind: 'number', value: input.slice(start, i) });
      continue;
    }
    if (input.startsWith('true', i) && !/[A-Za-z0-9_$]/.test(input[i + 4] ?? '')) {
      tokens.push({ kind: 'literal', value: 'true' });
      i += 4;
      continue;
    }
    if (input.startsWith('false', i) && !/[A-Za-z0-9_$]/.test(input[i + 5] ?? '')) {
      tokens.push({ kind: 'literal', value: 'false' });
      i += 5;
      continue;
    }
    if (input.startsWith('null', i) && !/[A-Za-z0-9_$]/.test(input[i + 4] ?? '')) {
      tokens.push({ kind: 'literal', value: 'null' });
      i += 4;
      continue;
    }
    return null;
  }

  return tokens;
}

function isValueToken(token: JsonToken | undefined): boolean {
  return token?.kind === 'string' || token?.kind === 'number' || token?.kind === 'literal';
}

/** Structural validation on tokens (no Number conversion). */
function validateJsonTokens(tokens: JsonToken[]): boolean {
  let pos = 0;

  const peek = () => tokens[pos];
  const consume = () => tokens[pos++];

  const parseValue = (): boolean => {
    const t = peek();
    if (!t) return false;
    if (isValueToken(t)) {
      consume();
      return true;
    }
    if (t.kind === 'punct' && t.value === '[') {
      consume();
      const inner = peek();
      if (inner?.kind === 'punct' && inner.value === ']') {
        consume();
        return true;
      }
      if (!parseValue()) return false;
      while (peek()?.kind === 'punct' && peek()!.value === ',') {
        consume();
        if (!parseValue()) return false;
      }
      const close = consume();
      return close?.kind === 'punct' && close.value === ']';
    }
    if (t.kind === 'punct' && t.value === '{') {
      consume();
      const inner = peek();
      if (inner?.kind === 'punct' && inner.value === '}') {
        consume();
        return true;
      }
      if (!parsePair()) return false;
      while (peek()?.kind === 'punct' && peek()!.value === ',') {
        consume();
        if (!parsePair()) return false;
      }
      const close = consume();
      return close?.kind === 'punct' && close.value === '}';
    }
    return false;
  };

  const parsePair = (): boolean => {
    const key = consume();
    if (key?.kind !== 'string') return false;
    const colon = consume();
    if (colon?.kind !== 'punct' || colon.value !== ':') return false;
    return parseValue();
  };

  if (!parseValue()) return false;
  return pos === tokens.length;
}

const JSON_INDENT = '  ';

/** Pretty-print by inserting whitespace only; all literals are copied verbatim. */
function prettyPrintJsonTokens(tokens: JsonToken[]): string {
  let result = '';
  let depth = 0;
  let atLineStart = true;

  const writeNewline = () => {
    result += '\n';
    atLineStart = true;
  };

  const writeIndent = () => {
    if (atLineStart) result += JSON_INDENT.repeat(depth);
    atLineStart = false;
  };

  const writeValue = (token: JsonToken) => {
    writeIndent();
    result += tokenForDisplay(token);
    atLineStart = false;
  };

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const next = tokens[i + 1];

    if (t.kind !== 'punct') {
      writeValue(t);
      continue;
    }

    switch (t.value) {
      case '{':
      case '[': {
        const close = t.value === '{' ? '}' : ']';
        // These can start a value at the beginning of a line (e.g. inside arrays),
        // so we must write indentation when needed.
        writeIndent();
        result += t.value;
        if (next?.kind === 'punct' && next.value === close) break;
        depth++;
        writeNewline();
        break;
      }
      case '}':
      case ']': {
        const open = t.value === '}' ? '{' : '[';
        const prev = tokens[i - 1];
        if (prev?.kind === 'punct' && prev.value === open) {
          result += t.value;
          break;
        }
        depth--;
        writeNewline();
        writeIndent();
        result += t.value;
        atLineStart = false;
        break;
      }
      case ',':
        result += ',';
        writeNewline();
        break;
      case ':':
        result += ': ';
        atLineStart = false;
        break;
      default:
        result += t.value;
        atLineStart = false;
    }
  }

  return result;
}

function parseJsonTokens(input: string): JsonToken[] | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const tokens = tokenizeJson(trimmed);
  if (!tokens || !validateJsonTokens(tokens)) return null;
  return tokens;
}

export function formatJson(input: string): { formatted: string; valid: boolean } {
  const tokens = parseJsonTokens(input);
  if (!tokens) return { formatted: input, valid: false };

  const first = tokens[0];
  const isDocument = first.kind === 'punct' && (first.value === '{' || first.value === '[');
  if (!isDocument) {
    if (first.kind === 'string') {
      return { formatted: decodeJsonStringToken(first.value), valid: true };
    }
    return { formatted: input, valid: true };
  }

  return { formatted: prettyPrintJsonTokens(tokens), valid: true };
}

export function isJson(input: string): boolean {
  return parseJsonTokens(input) !== null;
}

type NormalizeToJsonTextResult =
  | { ok: true; text: string }
  | { ok: false; text: string; reason: string };

function isIdentChar(ch: string | undefined): boolean {
  return ch !== undefined && /[A-Za-z0-9_$]/.test(ch);
}

/**
 * Best-effort normalize "object-like" text to JSON:
 * - single-quoted strings -> double-quoted JSON strings
 * - False/True/None -> false/true/null (outside strings)
 * - skips transformations inside `{{ ... }}` env placeholders
 */
export function normalizeToJsonText(input: string): NormalizeToJsonTextResult {
  if (!input) return { ok: true, text: input };

  let out = '';
  let i = 0;
  let mode: 'code' | 's' | 'd' = 'code';
  let sBuf = '';
  let braceDepth = 0;

  const flushSingle = () => {
    // Convert single-quoted string content to JSON double-quoted string.
    // Treat \' as ', keep other escapes as-is (best-effort).
    let content = '';
    for (let k = 0; k < sBuf.length; k++) {
      const ch = sBuf[k];
      if (ch === '\\' && k + 1 < sBuf.length) {
        const next = sBuf[k + 1];
        if (next === "'") {
          content += "'";
          k++;
          continue;
        }
        // Keep the backslash escape sequence; JSON allows most escapes we emit here.
        content += ch + next;
        k++;
        continue;
      }
      content += ch;
    }

    // Escape for JSON string.
    out += JSON.stringify(content);
    sBuf = '';
  };

  while (i < input.length) {
    const ch = input[i];

    // Skip transforms inside env placeholders {{ ... }}
    if (mode === 'code' && ch === '{' && input[i + 1] === '{') {
      const start = i;
      i += 2;
      braceDepth = 1;
      while (i < input.length) {
        if (input[i] === '{' && input[i + 1] === '{') {
          braceDepth++;
          i += 2;
          continue;
        }
        if (input[i] === '}' && input[i + 1] === '}') {
          braceDepth--;
          i += 2;
          if (braceDepth === 0) break;
          continue;
        }
        i++;
      }
      out += input.slice(start, i);
      continue;
    }

    if (mode === 's') {
      if (ch === '\\') {
        if (i + 1 < input.length) {
          sBuf += ch + input[i + 1];
          i += 2;
          continue;
        }
      }
      if (ch === "'") {
        flushSingle();
        mode = 'code';
        i++;
        continue;
      }
      sBuf += ch;
      i++;
      continue;
    }

    if (mode === 'd') {
      out += ch;
      if (ch === '\\') {
        if (i + 1 < input.length) {
          out += input[i + 1];
          i += 2;
          continue;
        }
      }
      if (ch === '"') mode = 'code';
      i++;
      continue;
    }

    // code mode
    if (ch === "'") {
      mode = 's';
      sBuf = '';
      i++;
      continue;
    }
    if (ch === '"') {
      mode = 'd';
      out += ch;
      i++;
      continue;
    }

    if (ch === 'F' && input.startsWith('False', i) && !isIdentChar(input[i - 1]) && !isIdentChar(input[i + 5])) {
      out += 'false';
      i += 5;
      continue;
    }
    if (ch === 'T' && input.startsWith('True', i) && !isIdentChar(input[i - 1]) && !isIdentChar(input[i + 4])) {
      out += 'true';
      i += 4;
      continue;
    }
    if (ch === 'N' && input.startsWith('None', i) && !isIdentChar(input[i - 1]) && !isIdentChar(input[i + 4])) {
      out += 'null';
      i += 4;
      continue;
    }

    out += ch;
    i++;
  }

  if (mode === 's') {
    return { ok: false, text: input, reason: "Unterminated single-quoted string" };
  }
  if (mode === 'd') {
    return { ok: false, text: input, reason: "Unterminated double-quoted string" };
  }

  return { ok: true, text: out };
}

// Simple regex-based JSON syntax highlighter
// Returns HTML-like string with <span class="json-*"> wrappers
// Groups: 1=key, 2=colon ws, 3=string, 4=bool/null, 5=number, 6=punctuation
const JSON_TOKEN_RE = /("(?:\\.|[^"\\])*")(\s*:\s*)|("(?:\\.|[^"\\])*")|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|([{}[\],])/g;

const STRING_MASK_MARK = '\x02';
const STRING_MASK_END = '\x03';
const STRING_PH_RE = /\x02([a-z]+)\x03/g;

function stringPlaceholder(idx: number): string {
  return `${STRING_MASK_MARK}${commentIndexSlug(idx)}${STRING_MASK_END}`;
}

type JsoncSegment = { type: 'code' | 'comment'; text: string };

/** Split JSONC into code vs comments (comments only outside string literals). */
function splitJsoncSegments(input: string): JsoncSegment[] {
  const segments: JsoncSegment[] = [];
  let buf = '';
  let i = 0;
  let mode: 'code' | 'string' | 'line_comment' | 'block_comment' = 'code';

  const flush = (type: JsoncSegment['type']) => {
    if (!buf) return;
    segments.push({ type, text: buf });
    buf = '';
  };

  while (i < input.length) {
    const ch = input[i];

    if (mode === 'code') {
      if (ch === '"') {
        buf += ch;
        i++;
        mode = 'string';
        continue;
      }
      if (ch === '/' && input[i + 1] === '/') {
        flush('code');
        i += 2;
        mode = 'line_comment';
        buf = '//';
        continue;
      }
      if (ch === '/' && input[i + 1] === '*') {
        flush('code');
        i += 2;
        mode = 'block_comment';
        buf = '/*';
        continue;
      }
      buf += ch;
      i++;
      continue;
    }

    if (mode === 'string') {
      buf += ch;
      if (ch === '\\') {
        i++;
        if (i < input.length) {
          buf += input[i];
          i++;
        }
        continue;
      }
      if (ch === '"') mode = 'code';
      i++;
      continue;
    }

    if (mode === 'line_comment') {
      buf += ch;
      i++;
      if (ch === '\n') {
        flush('comment');
        mode = 'code';
      }
      continue;
    }

    // block_comment
    buf += ch;
    if (ch === '*' && input[i + 1] === '/') {
      buf += '/';
      i += 2;
      flush('comment');
      mode = 'code';
      continue;
    }
    i++;
  }

  if (mode === 'line_comment' || mode === 'block_comment') flush('comment');
  else flush('code');

  return segments;
}

/** Mask JSON string literals so `//` inside URLs is not treated as a comment. */
function maskJsonStrings(input: string): { masked: string; strings: string[] } {
  const strings: string[] = [];
  let masked = '';
  let i = 0;

  while (i < input.length) {
    if (input[i] === '"') {
      const start = i;
      i++;
      while (i < input.length) {
        if (input[i] === '\\') {
          i += 2;
          if (i > input.length) break;
          continue;
        }
        if (input[i] === '"') {
          i++;
          break;
        }
        i++;
      }
      const idx = strings.length;
      strings.push(input.slice(start, i));
      masked += stringPlaceholder(idx);
      continue;
    }
    masked += input[i];
    i++;
  }

  return { masked, strings };
}

function unmaskJsonStrings(input: string, strings: string[]): string {
  return input.replace(STRING_PH_RE, (_, slug) => {
    const raw = strings[slugToCommentIndex(slug)] ?? '';
    return escapeHtml(raw);
  });
}

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

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function highlightJsonCode(input: string): string {
  const { masked: stringMasked, strings } = maskJsonStrings(input);
  const escaped = escapeHtml(stringMasked);
  const withStrings = unmaskJsonStrings(escaped, strings);

  return withStrings.replace(
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
}

export function highlightJson(input: string): string {
  const segments = splitJsoncSegments(input);
  return segments
    .map((seg) =>
      seg.type === 'comment'
        ? `<span class="json-comment">${escapeHtml(seg.text)}</span>`
        : highlightJsonCode(seg.text),
    )
    .join('');
}
