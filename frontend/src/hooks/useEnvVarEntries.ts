import { useMemo } from 'react';
import { useEnvironmentStore } from '../store/useEnvironmentStore';
import { buildRawVarMapForEnv } from '../utils/environmentScope';
import { resolveVariableMap } from '../utils/envInterpolation';

export type EnvSuggestRow = { name: string; value: string };

export function useEnvVarEntries(): EnvSuggestRow[] {
  const envEntriesSerialized = useEnvironmentStore((s) => {
    const raw = buildRawVarMapForEnv(s.variables, s.activeEnvironmentId);
    const map = resolveVariableMap(raw);
    const pairs = Object.keys(map)
      .sort((a, b) => a.localeCompare(b))
      .map((k): [string, string] => [k, map[k] ?? '']);
    return JSON.stringify(pairs);
  });

  return useMemo((): EnvSuggestRow[] => {
    try {
      const parsed: unknown = JSON.parse(envEntriesSerialized);
      if (!Array.isArray(parsed)) return [];
      const out: EnvSuggestRow[] = [];
      for (const row of parsed) {
        if (Array.isArray(row) && row.length >= 2 && typeof row[0] === 'string') {
          out.push({ name: row[0], value: String(row[1] ?? '') });
        }
      }
      return out;
    } catch {
      return [];
    }
  }, [envEntriesSerialized]);
}
