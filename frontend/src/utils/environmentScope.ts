import type { EnvVariableRow } from '../store/useEnvironmentStore';

/** When omitted, the variable exists in every environment (legacy rows). */
export function isVariableInEnv(row: EnvVariableRow, envId: string): boolean {
  if (!row.presentInEnvIds) return true;
  return row.presentInEnvIds.includes(envId);
}

export function buildRawVarMapForEnv(
  variables: EnvVariableRow[],
  envId: string,
): Record<string, string> {
  const raw: Record<string, string> = {};
  for (const row of variables) {
    const k = row.key.trim();
    if (!k) continue;
    if (!isVariableInEnv(row, envId)) continue;
    raw[k] = row.valuesByEnvId[envId] ?? '';
  }
  return raw;
}

/** Normalize scope after add/remove environment columns. */
export function normalizePresentInEnvIds(
  presentInEnvIds: string[] | undefined,
  allEnvironmentIds: string[],
): string[] | undefined {
  if (!presentInEnvIds) return undefined;
  const valid = new Set(allEnvironmentIds);
  const next = presentInEnvIds.filter((id) => valid.has(id));
  if (next.length === 0) return [];
  if (next.length === allEnvironmentIds.length) return undefined;
  return next;
}

export function presentInEnvIdsAfterEnable(
  presentInEnvIds: string[] | undefined,
  envId: string,
  allEnvironmentIds: string[],
): string[] | undefined {
  if (!presentInEnvIds) return undefined;
  if (presentInEnvIds.includes(envId)) return presentInEnvIds;
  const next = [...presentInEnvIds, envId];
  if (next.length >= allEnvironmentIds.length) return undefined;
  return next;
}

export function presentInEnvIdsAfterDisable(
  presentInEnvIds: string[] | undefined,
  envId: string,
  allEnvironmentIds: string[],
): string[] | undefined {
  if (!presentInEnvIds) {
    const next = allEnvironmentIds.filter((id) => id !== envId);
    if (next.length === 0) return [];
    if (next.length === allEnvironmentIds.length) return undefined;
    return next;
  }
  const next = presentInEnvIds.filter((id) => id !== envId);
  if (next.length === 0) return [];
  if (next.length === allEnvironmentIds.length) return undefined;
  return next;
}
