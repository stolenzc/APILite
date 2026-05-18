import { create } from 'zustand';
import { nanoid } from 'nanoid';
import { invoke } from '@tauri-apps/api/core';
import { isTauri } from '../tauri/setupMenu';
import { resolveVariableMap } from '../utils/envInterpolation';

/** One column = one environment (e.g. Default, Staging). */
export interface EnvColumn {
  id: string;
  name: string;
}

/** One row = one variable name; cells = value per environment. */
export interface EnvVariableRow {
  id: string;
  key: string;
  valuesByEnvId: Record<string, string>;
}

interface PersistedV2 {
  version: 2;
  environments: EnvColumn[];
  variables: EnvVariableRow[];
  activeEnvironmentId: string;
}

interface LegacyEnv {
  id: string;
  name: string;
  rows: { id: string; key: string; value: string }[];
}

interface EnvironmentState {
  environments: EnvColumn[];
  variables: EnvVariableRow[];
  activeEnvironmentId: string;
  envModalOpen: boolean;

  setEnvModalOpen: (open: boolean) => void;
  setActiveEnvironmentId: (id: string) => void;
  addEnvironmentColumn: () => void;
  /** Alias of `addEnvironmentColumn` (legacy / external callers). */
  addEnvironment: () => void;
  removeEnvironmentColumn: (id: string) => void;
  renameEnvironmentColumn: (id: string, name: string) => void;
  addVariableRow: () => void;
  removeVariableRow: (rowId: string) => void;
  updateVariableKey: (rowId: string, key: string) => void;
  updateCell: (rowId: string, envId: string, value: string) => void;
  /** Raw cells for active env, then `{{}}` cross-references resolved. */
  getActiveVarMap: () => Record<string, string>;
}

const STORAGE_V2 = 'APILite-environments-v2';
const STORAGE_V1 = 'APILite-environments-v1';

function defaultState(): Omit<
  EnvironmentState,
  | 'setEnvModalOpen'
  | 'setActiveEnvironmentId'
  | 'addEnvironmentColumn'
  | 'addEnvironment'
  | 'removeEnvironmentColumn'
  | 'renameEnvironmentColumn'
  | 'addVariableRow'
  | 'removeVariableRow'
  | 'updateVariableKey'
  | 'updateCell'
  | 'getActiveVarMap'
> {
  const id = nanoid();
  return {
    environments: [{ id, name: 'Default' }],
    variables: [],
    activeEnvironmentId: id,
    envModalOpen: false,
  };
}

function migrateV1(parsed: { environments?: LegacyEnv[]; activeEnvironmentId?: string }): Omit<
  EnvironmentState,
  | 'setEnvModalOpen'
  | 'setActiveEnvironmentId'
  | 'addEnvironmentColumn'
  | 'addEnvironment'
  | 'removeEnvironmentColumn'
  | 'renameEnvironmentColumn'
  | 'addVariableRow'
  | 'removeVariableRow'
  | 'updateVariableKey'
  | 'updateCell'
  | 'getActiveVarMap'
> | null {
  const list = parsed.environments;
  if (!list?.length || !('rows' in list[0])) return null;

  const environments: EnvColumn[] = list.map((e) => ({ id: e.id, name: e.name }));
  const keyOrder: string[] = [];
  const keyToCells: Record<string, Record<string, string>> = {};

  for (const e of list) {
    for (const r of e.rows || []) {
      const k = String(r.key || '').trim();
      if (!k) continue;
      if (!keyToCells[k]) {
        keyToCells[k] = {};
        keyOrder.push(k);
      }
      keyToCells[k][e.id] = r.value ?? '';
    }
  }

  const variables: EnvVariableRow[] = keyOrder.map((key) => ({
    id: nanoid(),
    key,
    valuesByEnvId: { ...keyToCells[key] },
  }));

  const active =
    parsed.activeEnvironmentId && environments.some((c) => c.id === parsed.activeEnvironmentId)
      ? parsed.activeEnvironmentId
      : environments[0].id;

  return { environments, variables, activeEnvironmentId: active, envModalOpen: false };
}

/** Parse persisted v2 JSON (localStorage or disk). */
function parsePersistedV2(raw: string): Omit<
  EnvironmentState,
  | 'setEnvModalOpen'
  | 'setActiveEnvironmentId'
  | 'addEnvironmentColumn'
  | 'addEnvironment'
  | 'removeEnvironmentColumn'
  | 'renameEnvironmentColumn'
  | 'addVariableRow'
  | 'removeVariableRow'
  | 'updateVariableKey'
  | 'updateCell'
  | 'getActiveVarMap'
> | null {
  try {
    const p = JSON.parse(raw) as PersistedV2;
    if (p.version !== 2 || !p.environments?.length) return null;
    const active =
      p.activeEnvironmentId && p.environments.some((e) => e.id === p.activeEnvironmentId)
        ? p.activeEnvironmentId
        : p.environments[0].id;
    return {
      environments: p.environments,
      variables: Array.isArray(p.variables) ? p.variables : [],
      activeEnvironmentId: active,
      envModalOpen: false,
    };
  } catch {
    return null;
  }
}

function load(): Omit<
  EnvironmentState,
  | 'setEnvModalOpen'
  | 'setActiveEnvironmentId'
  | 'addEnvironmentColumn'
  | 'addEnvironment'
  | 'removeEnvironmentColumn'
  | 'renameEnvironmentColumn'
  | 'addVariableRow'
  | 'removeVariableRow'
  | 'updateVariableKey'
  | 'updateCell'
  | 'getActiveVarMap'
> {
  try {
    const raw2 = localStorage.getItem(STORAGE_V2);
    if (raw2) {
      const parsed = parsePersistedV2(raw2);
      if (parsed) return parsed;
    }
    const raw1 = localStorage.getItem(STORAGE_V1);
    if (raw1) {
      const migrated = migrateV1(JSON.parse(raw1));
      if (migrated) return migrated;
    }
  } catch {
    /* ignore */
  }
  return defaultState();
}

function buildPayload(
  state: Pick<EnvironmentState, 'environments' | 'variables' | 'activeEnvironmentId'>,
): PersistedV2 {
  return {
    version: 2,
    environments: state.environments,
    variables: state.variables,
    activeEnvironmentId: state.activeEnvironmentId,
  };
}

function save(
  state: Pick<EnvironmentState, 'environments' | 'variables' | 'activeEnvironmentId'>,
) {
  const payload = buildPayload(state);
  const json = JSON.stringify(payload);
  try {
    localStorage.setItem(STORAGE_V2, json);
  } catch {
    /* ignore */
  }
  if (isTauri()) {
    void invoke('environments_save', { data: json }).catch((err) =>
      console.error('Failed to save environments to local file:', err),
    );
  }
}

export const useEnvironmentStore = create<EnvironmentState>((set, get) => {
  const initial = load();
  return {
    ...initial,

    setEnvModalOpen: (envModalOpen) => set({ envModalOpen }),

    setActiveEnvironmentId: (activeEnvironmentId) =>
      set((s) => {
        const next = { ...s, activeEnvironmentId };
        save(next);
        return next;
      }),

    addEnvironmentColumn: () =>
      set((s) => {
        const n = s.environments.length + 1;
        const id = nanoid();
        const col: EnvColumn = { id, name: `Environment ${n}` };
        const variables = s.variables.map((row) => ({
          ...row,
          valuesByEnvId: { ...row.valuesByEnvId, [id]: '' },
        }));
        const next = {
          ...s,
          environments: [...s.environments, col],
          variables,
          activeEnvironmentId: id,
        };
        save(next);
        return next;
      }),

    addEnvironment: () => get().addEnvironmentColumn(),

    removeEnvironmentColumn: (id) =>
      set((s) => {
        if (s.environments.length <= 1) return s;
        const environments = s.environments.filter((e) => e.id !== id);
        const variables = s.variables.map((row) => {
          const { [id]: _, ...rest } = row.valuesByEnvId;
          return { ...row, valuesByEnvId: rest };
        });
        let activeEnvironmentId = s.activeEnvironmentId;
        if (activeEnvironmentId === id) activeEnvironmentId = environments[0].id;
        const next = { ...s, environments, variables, activeEnvironmentId };
        save(next);
        return next;
      }),

    renameEnvironmentColumn: (id, name) =>
      set((s) => {
        const environments = s.environments.map((e) =>
          e.id === id ? { ...e, name } : e,
        );
        const next = { ...s, environments };
        save(next);
        return next;
      }),

    addVariableRow: () =>
      set((s) => {
        const valuesByEnvId: Record<string, string> = {};
        for (const e of s.environments) valuesByEnvId[e.id] = '';
        const row: EnvVariableRow = { id: nanoid(), key: '', valuesByEnvId };
        const next = { ...s, variables: [...s.variables, row] };
        save(next);
        return next;
      }),

    removeVariableRow: (rowId) =>
      set((s) => {
        const next = { ...s, variables: s.variables.filter((r) => r.id !== rowId) };
        save(next);
        return next;
      }),

    updateVariableKey: (rowId, key) =>
      set((s) => {
        const variables = s.variables.map((r) => (r.id === rowId ? { ...r, key } : r));
        const next = { ...s, variables };
        save(next);
        return next;
      }),

    updateCell: (rowId, envId, value) =>
      set((s) => {
        const variables = s.variables.map((r) =>
          r.id === rowId
            ? { ...r, valuesByEnvId: { ...r.valuesByEnvId, [envId]: value } }
            : r,
        );
        const next = { ...s, variables };
        save(next);
        return next;
      }),

    getActiveVarMap: (): Record<string, string> => {
      const s = get();
      const envId = s.activeEnvironmentId;
      const raw: Record<string, string> = {};
      for (const row of s.variables) {
        const k = row.key.trim();
        if (!k) continue;
        raw[k] = row.valuesByEnvId[envId] ?? '';
      }
      return resolveVariableMap(raw);
    },
  };
});

/**
 * Tauri: load `~/.APILite/environments.json` after startup (disk overrides localStorage when present).
 * If the file is missing, writes the current in-memory state (from localStorage / defaults) to disk.
 */
export async function hydrateEnvironmentsFromDisk(): Promise<void> {
  if (!isTauri()) return;
  try {
    const rawOpt = await invoke<string | null>('environments_load');
    if (rawOpt != null && rawOpt !== '') {
      const parsed = parsePersistedV2(rawOpt);
      if (parsed) {
        useEnvironmentStore.setState(parsed);
        try {
          localStorage.setItem(STORAGE_V2, JSON.stringify(buildPayload(parsed)));
        } catch {
          /* ignore */
        }
        return;
      }
    }
    const s = useEnvironmentStore.getState();
    save({
      environments: s.environments,
      variables: s.variables,
      activeEnvironmentId: s.activeEnvironmentId,
    });
  } catch (err) {
    console.error('Failed to hydrate environments from disk:', err);
  }
}
