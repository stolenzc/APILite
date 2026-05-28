import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { nanoid } from 'nanoid';
import type { ScriptEntry, ScriptsManifest } from '../types';
import { getDataDir } from '../utils/storagePaths';
import { isTauri } from '../tauri/setupMenu';

interface ScriptState {
  scripts: ScriptEntry[];
  venvReady: boolean;
  scriptsDirPath: string;
  loaded: boolean;
  managerOpen: boolean;

  setManagerOpen: (open: boolean) => void;
  hydrate: () => Promise<void>;
  refreshVenv: () => Promise<void>;
  createScript: (name: string, description: string) => Promise<ScriptEntry>;
  updateScript: (
    id: string,
    patch: { name?: string; description?: string; source?: string },
  ) => Promise<void>;
  deleteScript: (id: string) => Promise<void>;
  readSource: (id: string) => Promise<string>;
}

export const useScriptStore = create<ScriptState>((set) => ({
  scripts: [],
  venvReady: false,
  scriptsDirPath: '',
  loaded: false,
  managerOpen: false,

  setManagerOpen: (open) => set({ managerOpen: open }),

  hydrate: async () => {
    if (!isTauri()) {
      set({ loaded: true, scripts: [], venvReady: false });
      return;
    }
    const dataDir = getDataDir();
    if (!dataDir) {
      set({ loaded: true });
      return;
    }
    try {
      const [manifest, venvReady, scriptsDirPath] = await Promise.all([
        invoke<ScriptsManifest>('scripts_list', { dataDir }),
        invoke<boolean>('scripts_venv_ready', { dataDir }),
        invoke<string>('scripts_dir_path', { dataDir }),
      ]);
      set({
        scripts: manifest.scripts ?? [],
        venvReady,
        scriptsDirPath,
        loaded: true,
      });
    } catch (err) {
      console.error('Failed to load scripts:', err);
      set({ loaded: true });
    }
  },

  refreshVenv: async () => {
    if (!isTauri()) return;
    const dataDir = getDataDir();
    if (!dataDir) return;
    const venvReady = await invoke<boolean>('scripts_venv_ready', { dataDir });
    set({ venvReady });
  },

  createScript: async (name, description) => {
    const dataDir = getDataDir();
    const entry = await invoke<ScriptEntry>('scripts_create', {
      dataDir,
      id: nanoid(10),
      name: name.trim() || 'New script',
      description: description.trim(),
    });
    set((s) => ({ scripts: [...s.scripts, entry] }));
    return entry;
  },

  updateScript: async (id, patch) => {
    const dataDir = getDataDir();
    const entry = await invoke<ScriptEntry>('scripts_update', {
      dataDir,
      id,
      name: patch.name ?? null,
      description: patch.description ?? null,
      source: patch.source ?? null,
    });
    set((s) => ({
      scripts: s.scripts.map((sc) => (sc.id === id ? entry : sc)),
    }));
  },

  deleteScript: async (id) => {
    const dataDir = getDataDir();
    await invoke('scripts_delete', { dataDir, id });
    set((s) => ({ scripts: s.scripts.filter((sc) => sc.id !== id) }));
  },

  readSource: async (id) => {
    const dataDir = getDataDir();
    return invoke<string>('scripts_read_source', { dataDir, id });
  },
}));
