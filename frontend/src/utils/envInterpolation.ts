/** `{{varName}}` — whitespace inside braces is trimmed. */
const PLACEHOLDER = /\{\{\s*([^}]*?)\s*\}\}/g;

const HTTP_PROTOCOL_RE = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//;

/** Whether a URL string already has a scheme (use on env-resolved URLs, not raw `{{}}` templates). */
export function hasHttpProtocol(url: string): boolean {
  return HTTP_PROTOCOL_RE.test(url);
}

/** Cursor inside an unclosed `{{ ...` (no `}}` yet before cursor). Used for URL env autocomplete. */
export function parseOpenEnvPlaceholder(value: string, cursor: number): {
  innerStart: number;
  innerEnd: number;
  partialRaw: string;
} | null {
  const before = value.slice(0, cursor);
  const open = before.lastIndexOf('{{');
  if (open === -1) return null;
  const innerStart = open + 2;
  const innerSlice = before.slice(innerStart);
  if (innerSlice.includes('}}')) return null;
  return { innerStart, innerEnd: cursor, partialRaw: innerSlice };
}

export function interpolateEnvVars(input: string, vars: Record<string, string>): string {
  return input.replace(PLACEHOLDER, (_, rawName: string) => {
    const name = String(rawName).trim();
    if (!name) return '';
    return Object.prototype.hasOwnProperty.call(vars, name) ? vars[name]! : '';
  });
}

/**
 * Interpolate only placeholders whose names are in `allowed`.
 * - Not allowed: keep the original `{{ ... }}` text.
 * - Allowed but missing: keep the placeholder (do not blank it).
 *
 * Used for two-phase interpolation around pre-request scripts:
 * phase 1 resolves known vars, phase 2 resolves only script-updated vars.
 */
export function interpolateEnvVarsSelected(
  input: string,
  vars: Record<string, string>,
  allowed: ReadonlySet<string>,
): string {
  return input.replace(PLACEHOLDER, (full: string, rawName: string) => {
    const name = String(rawName).trim();
    if (!name) return '';
    if (!allowed.has(name)) return full;
    return Object.prototype.hasOwnProperty.call(vars, name) ? vars[name]! : full;
  });
}

/** Resolve `{{other}}` references between variables (same environment), multi-pass. */
const MAX_RESOLVE_PASSES = 48;

export function resolveVariableMap(raw: Record<string, string>): Record<string, string> {
  const result = { ...raw };
  for (let pass = 0; pass < MAX_RESOLVE_PASSES; pass++) {
    let changed = false;
    for (const key of Object.keys(result)) {
      const next = interpolateEnvVars(result[key], result);
      if (next !== result[key]) {
        result[key] = next;
        changed = true;
      }
    }
    if (!changed) break;
  }
  return result;
}

export function interpolateKeyValues(
  kvs: { key: string; value: string; enabled: boolean }[],
  vars: Record<string, string>,
): { key: string; value: string; enabled: boolean }[] {
  return kvs.map((kv) => ({
    ...kv,
    key: interpolateEnvVars(kv.key, vars),
    value: interpolateEnvVars(kv.value, vars),
  }));
}

export function interpolateKeyValuesSelected(
  kvs: { key: string; value: string; enabled: boolean }[],
  vars: Record<string, string>,
  allowed: ReadonlySet<string>,
): { key: string; value: string; enabled: boolean }[] {
  return kvs.map((kv) => ({
    ...kv,
    key: interpolateEnvVarsSelected(kv.key, vars, allowed),
    value: interpolateEnvVarsSelected(kv.value, vars, allowed),
  }));
}
