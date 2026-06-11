import { useMemo } from 'react';
import { useEnvironmentStore } from '../store/useEnvironmentStore';
import { useStore } from '../store/useStore';
import { resolveVariableMap } from './envInterpolation';
import { buildRawVarMapForEnv } from './environmentScope';
import type { ParseJsoncOptions } from './jsonUtils';
import { parseJsonc } from './jsonUtils';

/** Environment variables plus script output vars from the active tab (script overrides env). */
export function getMergedInterpolationVars(): Record<string, string> {
  const env = useEnvironmentStore.getState().getActiveVarMap();
  const tab = useStore.getState().tabs.find((t) => t.id === useStore.getState().activeTabId);
  const scriptVars = tab?.scriptVars ?? {};
  return { ...env, ...scriptVars };
}

/** Subscribe to env/script var changes (for re-running JSONC lint, etc.). */
export function useInterpolationVarsSignature(): string {
  const envSig = useEnvironmentStore((s) => {
    const raw = buildRawVarMapForEnv(s.variables, s.activeEnvironmentId);
    const map = resolveVariableMap(raw);
    const pairs = Object.keys(map)
      .sort((a, b) => a.localeCompare(b))
      .map((k): [string, string] => [k, map[k] ?? '']);
    return `${s.activeEnvironmentId}\0${JSON.stringify(pairs)}`;
  });
  const scriptSig = useStore((s) => {
    const tab = s.tabs.find((t) => t.id === s.activeTabId);
    const sv = tab?.scriptVars ?? {};
    const pairs = Object.keys(sv)
      .sort((a, b) => a.localeCompare(b))
      .map((k): [string, string] => [k, sv[k] ?? '']);
    return JSON.stringify(pairs);
  });
  return useMemo(() => `${envSig}|${scriptSig}`, [envSig, scriptSig]);
}

/** Parse JSONC for editor validation: interpolate env vars, then strip unresolved placeholders. */
export function parseJsoncForValidation(
  input: string,
  options?: Omit<ParseJsoncOptions, 'ignoreEnvPlaceholders' | 'envVars'>,
) {
  return parseJsonc(input, {
    ...options,
    ignoreEnvPlaceholders: true,
    envVars: getMergedInterpolationVars(),
  });
}
