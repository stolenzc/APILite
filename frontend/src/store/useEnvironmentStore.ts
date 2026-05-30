import { create } from 'zustand';
import { nanoid } from 'nanoid';
import { invoke } from '@tauri-apps/api/core';
import { isTauri } from '../tauri/setupMenu';
import { getDataDir } from '../utils/storagePaths';
import { buildActiveVarMap } from '../utils/builtinEnvVars';
import {
  isVariableInEnv,
  normalizePresentInEnvIds,
  presentInEnvIdsAfterDisable,
  presentInEnvIdsAfterEnable,
} from '../utils/environmentScope';
import { t } from '../i18n';

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
  /** When set, the variable only exists in these environment columns. */
  presentInEnvIds?: string[];
}

interface PersistedV2 {
  version: 2;
  environments: EnvColumn[];
  variables: EnvVariableRow[];
  activeEnvironmentId: string;
}

interface EnvironmentState {
  environments: EnvColumn[];
  variables: EnvVariableRow[];
  activeEnvironmentId: string;
  envModalOpen: boolean;

  setEnvModalOpen: (open: boolean) => void;
  setActiveEnvironmentId: (id: string) => void;
  addEnvironmentColumn: () => void;
  removeEnvironmentColumn: (id: string) => void;
  duplicateEnvironmentColumn: (id: string) => void;
  renameEnvironmentColumn: (id: string, name: string) => void;
  addVariableRow: () => void;
  removeVariableRow: (rowId: string) => void;
  duplicateVariableRow: (rowId: string) => void;
  updateVariableKey: (rowId: string, key: string) => void;
  updateCell: (rowId: string, envId: string, value: string) => void;
  setVariableInEnv: (rowId: string, envId: string, present: boolean) => void;
  scopeVariableToEnvOnly: (rowId: string, envId: string) => void;
  reorderVariableRows: (activeId: string, overId: string) => void;
  reorderEnvironmentColumns: (activeId: string, overId: string) => void;
  /** Raw cells for active env, then `{{}}` cross-references resolved. */
  getActiveVarMap: () => Record<string, string>;
}

function reorderById<T extends { id: string }>(list: T[], activeId: string, overId: string): T[] {
  if (activeId === overId) return list;
  const from = list.findIndex((item) => item.id === activeId);
  const to = list.findIndex((item) => item.id === overId);
  if (from === -1 || to === -1) return list;
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

const STORAGE_V2 = 'APILite-environments-v2';

function defaultState(): Omit<
  EnvironmentState,
  | 'setEnvModalOpen'
  | 'setActiveEnvironmentId'
  | 'addEnvironmentColumn'
  | 'removeEnvironmentColumn'
  | 'duplicateEnvironmentColumn'
  | 'renameEnvironmentColumn'
  | 'addVariableRow'
  | 'removeVariableRow'
  | 'duplicateVariableRow'
  | 'updateVariableKey'
  | 'updateCell'
  | 'setVariableInEnv'
  | 'scopeVariableToEnvOnly'
  | 'reorderVariableRows'
  | 'reorderEnvironmentColumns'
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

/** Parse persisted v2 JSON (localStorage or disk). */
function parsePersistedV2(raw: string): Omit<
  EnvironmentState,
  | 'setEnvModalOpen'
  | 'setActiveEnvironmentId'
  | 'addEnvironmentColumn'
  | 'removeEnvironmentColumn'
  | 'duplicateEnvironmentColumn'
  | 'renameEnvironmentColumn'
  | 'addVariableRow'
  | 'removeVariableRow'
  | 'duplicateVariableRow'
  | 'updateVariableKey'
  | 'updateCell'
  | 'setVariableInEnv'
  | 'scopeVariableToEnvOnly'
  | 'reorderVariableRows'
  | 'reorderEnvironmentColumns'
  | 'getActiveVarMap'
> | null {
  try {
    const p = JSON.parse(raw) as PersistedV2;
    if (p.version !== 2 || !p.environments?.length) return null;
    const active =
      p.activeEnvironmentId && p.environments.some((e) => e.id === p.activeEnvironmentId)
        ? p.activeEnvironmentId
        : p.environments[0].id;
    const envIds = p.environments.map((e) => e.id);
    const variables = (Array.isArray(p.variables) ? p.variables : []).map((row) => ({
      ...row,
      presentInEnvIds: normalizePresentInEnvIds(row.presentInEnvIds, envIds),
    }));
    return {
      environments: p.environments,
      variables,
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
  | 'removeEnvironmentColumn'
  | 'duplicateEnvironmentColumn'
  | 'renameEnvironmentColumn'
  | 'addVariableRow'
  | 'removeVariableRow'
  | 'duplicateVariableRow'
  | 'updateVariableKey'
  | 'updateCell'
  | 'setVariableInEnv'
  | 'scopeVariableToEnvOnly'
  | 'reorderVariableRows'
  | 'reorderEnvironmentColumns'
  | 'getActiveVarMap'
> {
  try {
    const raw = localStorage.getItem(STORAGE_V2);
    if (raw) {
      const parsed = parsePersistedV2(raw);
      if (parsed) return parsed;
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
  const dataDir = getDataDir();
  if (isTauri() && dataDir) {
    void invoke('environments_save', { dataDir, data: json }).catch((err) =>
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
        const variables = s.variables.map((row) => {
          if (row.presentInEnvIds) return row;
          return {
            ...row,
            valuesByEnvId: { ...row.valuesByEnvId, [id]: '' },
          };
        });
        const next = {
          ...s,
          environments: [...s.environments, col],
          variables,
          activeEnvironmentId: id,
        };
        save(next);
        return next;
      }),

    removeEnvironmentColumn: (id) =>
      set((s) => {
        if (s.environments.length <= 1) return s;
        const environments = s.environments.filter((e) => e.id !== id);
        const variables = s.variables.map((row) => {
          const { [id]: _, ...rest } = row.valuesByEnvId;
          return {
            ...row,
            valuesByEnvId: rest,
            presentInEnvIds: normalizePresentInEnvIds(row.presentInEnvIds, environments.map((e) => e.id)),
          };
        });
        let activeEnvironmentId = s.activeEnvironmentId;
        if (activeEnvironmentId === id) activeEnvironmentId = environments[0].id;
        const next = { ...s, environments, variables, activeEnvironmentId };
        save(next);
        return next;
      }),

    duplicateEnvironmentColumn: (id) =>
      set((s) => {
        const idx = s.environments.findIndex((e) => e.id === id);
        if (idx === -1) return s;
        const src = s.environments[idx];
        const newId = nanoid();
        const label = (src.name || 'Environment').trim() || 'Environment';
        const col: EnvColumn = { id: newId, name: `${label} ${t('env.copySuffix')}` };
        const environments = [...s.environments];
        environments.splice(idx + 1, 0, col);
        const variables = s.variables.map((row) => {
          const valuesByEnvId = {
            ...row.valuesByEnvId,
            [newId]: row.valuesByEnvId[id] ?? '',
          };
          if (!isVariableInEnv(row, id)) {
            return { ...row, valuesByEnvId };
          }
          const presentInEnvIds = row.presentInEnvIds
            ? [...row.presentInEnvIds, newId]
            : undefined;
          return { ...row, valuesByEnvId, presentInEnvIds };
        });
        const next = { ...s, environments, variables, activeEnvironmentId: newId };
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

    duplicateVariableRow: (rowId) =>
      set((s) => {
        const idx = s.variables.findIndex((r) => r.id === rowId);
        if (idx === -1) return s;
        const src = s.variables[idx];
        const row: EnvVariableRow = {
          id: nanoid(),
          key: src.key,
          valuesByEnvId: { ...src.valuesByEnvId },
          presentInEnvIds: src.presentInEnvIds ? [...src.presentInEnvIds] : undefined,
        };
        const variables = [...s.variables];
        variables.splice(idx + 1, 0, row);
        const next = { ...s, variables };
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
        const envIds = s.environments.map((e) => e.id);
        const variables = s.variables.map((r) => {
          if (r.id !== rowId) return r;
          let presentInEnvIds = r.presentInEnvIds;
          if (!isVariableInEnv(r, envId)) {
            presentInEnvIds = presentInEnvIdsAfterEnable(presentInEnvIds, envId, envIds);
          }
          return {
            ...r,
            presentInEnvIds,
            valuesByEnvId: { ...r.valuesByEnvId, [envId]: value },
          };
        });
        const next = { ...s, variables };
        save(next);
        return next;
      }),

    setVariableInEnv: (rowId, envId, present) =>
      set((s) => {
        const envIds = s.environments.map((e) => e.id);
        const variables = s.variables.map((r) => {
          if (r.id !== rowId) return r;
          if (present) {
            const presentInEnvIds = presentInEnvIdsAfterEnable(r.presentInEnvIds, envId, envIds);
            return {
              ...r,
              presentInEnvIds,
              valuesByEnvId: { ...r.valuesByEnvId, [envId]: r.valuesByEnvId[envId] ?? '' },
            };
          }
          return {
            ...r,
            presentInEnvIds: presentInEnvIdsAfterDisable(r.presentInEnvIds, envId, envIds),
          };
        });
        const next = { ...s, variables };
        save(next);
        return next;
      }),

    scopeVariableToEnvOnly: (rowId, envId) =>
      set((s) => {
        const variables = s.variables.map((r) =>
          r.id === rowId ? { ...r, presentInEnvIds: [envId] } : r,
        );
        const next = { ...s, variables };
        save(next);
        return next;
      }),

    reorderVariableRows: (activeId, overId) =>
      set((s) => {
        const variables = reorderById(s.variables, activeId, overId);
        if (variables === s.variables) return s;
        const next = { ...s, variables };
        save(next);
        return next;
      }),

    reorderEnvironmentColumns: (activeId, overId) =>
      set((s) => {
        const environments = reorderById(s.environments, activeId, overId);
        if (environments === s.environments) return s;
        const next = { ...s, environments };
        save(next);
        return next;
      }),

    getActiveVarMap: (): Record<string, string> => {
      const s = get();
      return buildActiveVarMap(s.variables, s.activeEnvironmentId);
    },
  };
});

/**
 * Tauri: load `{dataDir}/environments.json` after startup (disk overrides localStorage when present).
 * If the file is missing, writes the current in-memory state (from localStorage / defaults) to disk.
 */
export async function hydrateEnvironmentsFromDisk(): Promise<void> {
  if (!isTauri()) return;
  const dataDir = getDataDir();
  if (!dataDir) return;
  try {
    const rawOpt = await invoke<string | null>('environments_load', { dataDir });
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
