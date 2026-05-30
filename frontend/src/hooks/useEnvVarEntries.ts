import { useMemo } from 'react';
import { useEnvironmentStore } from '../store/useEnvironmentStore';
import { resolveVariableMap } from '../utils/envInterpolation';
import { buildRawVarMapForEnv } from '../utils/environmentScope';
import {
  BUILTIN_ENV_VAR_NAMES,
  getBuiltinVarMap,
  isBuiltinEnvVar,
} from '../utils/builtinEnvVars';

export type EnvSuggestRow = { name: string; value: string; builtin?: boolean };

export function useEnvVarEntries(): EnvSuggestRow[] {
  /** User vars only — built-ins change every ms and must not drive Zustand subscriptions. */
  const userVarsSerialized = useEnvironmentStore((s) => {
    const raw = buildRawVarMapForEnv(s.variables, s.activeEnvironmentId);
    const map = resolveVariableMap(raw);
    const pairs = Object.keys(map)
      .sort((a, b) => a.localeCompare(b))
      .map((k): [string, string] => [k, map[k] ?? '']);
    return JSON.stringify(pairs);
  });

  return useMemo((): EnvSuggestRow[] => {
    const builtins = getBuiltinVarMap();
    const out: EnvSuggestRow[] = BUILTIN_ENV_VAR_NAMES.map((name) => ({
      name,
      value: builtins[name] ?? '',
      builtin: true,
    }));
    try {
      const parsed: unknown = JSON.parse(userVarsSerialized);
      if (!Array.isArray(parsed)) return out;
      for (const row of parsed) {
        if (Array.isArray(row) && row.length >= 2 && typeof row[0] === 'string') {
          const name = row[0];
          if (isBuiltinEnvVar(name)) continue;
          out.push({ name, value: String(row[1] ?? ''), builtin: false });
        }
      }
    } catch {
      /* ignore */
    }
    return out;
  }, [userVarsSerialized]);
}
