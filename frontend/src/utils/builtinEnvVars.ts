import { resolveVariableMap } from './envInterpolation';
import { buildRawVarMapForEnv } from './environmentScope';
import type { EnvVariableRow } from '../store/useEnvironmentStore';

/** Built-in `{{name}}` placeholders; recomputed on each resolution (e.g. per send). */
export const BUILTIN_ENV_VAR_NAMES = [
  '$timestamp',
  '$timestampMs',
  '$isoTimestamp',
  '$date',
  '$time',
  '$uuid',
] as const;

export type BuiltinEnvVarName = (typeof BUILTIN_ENV_VAR_NAMES)[number];

const BUILTIN_SET = new Set<string>(BUILTIN_ENV_VAR_NAMES);

export function isBuiltinEnvVar(name: string): boolean {
  return BUILTIN_SET.has(name.trim());
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatLocalDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function formatLocalTime(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

function randomUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Fresh values for built-in placeholders (not persisted in environments.json). */
export function getBuiltinVarMap(): Record<string, string> {
  const now = new Date();
  return {
    $timestamp: String(Math.floor(now.getTime() / 1000)),
    $timestampMs: String(now.getTime()),
    $isoTimestamp: now.toISOString(),
    $date: formatLocalDate(now),
    $time: formatLocalTime(now),
    $uuid: randomUuid(),
  };
}

/** User variables for active env, with `{{}}` cross-refs and built-ins merged. */
export function buildActiveVarMap(
  variables: EnvVariableRow[],
  envId: string,
): Record<string, string> {
  const raw = buildRawVarMapForEnv(variables, envId);
  const builtins = getBuiltinVarMap();
  return { ...resolveVariableMap({ ...builtins, ...raw }), ...builtins };
}
