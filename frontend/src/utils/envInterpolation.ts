/** `{{varName}}` — whitespace inside braces is trimmed. */
const PLACEHOLDER = /\{\{\s*([^}]*?)\s*\}\}/g;

export function interpolateEnvVars(input: string, vars: Record<string, string>): string {
  return input.replace(PLACEHOLDER, (_, rawName: string) => {
    const name = String(rawName).trim();
    if (!name) return '';
    return Object.prototype.hasOwnProperty.call(vars, name) ? vars[name]! : '';
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
