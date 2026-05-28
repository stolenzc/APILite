import { invoke } from '@tauri-apps/api/core';
import { useSettingsStore } from '../store/useSettings';
import { isTauri } from '../tauri/setupMenu';

export const FOLDERS_SUBDIR = 'folders';
export const HISTORIES_SUBDIR = 'histories';
export const SCRIPTS_SUBDIR = 'scripts';
export const ENVIRONMENTS_FILE = 'environments.json';

/** Join path segments using the separator style of the base path. */
export function joinPath(base: string, ...segments: string[]): string {
  const trimmed = base.replace(/[/\\]+$/, '');
  if (!trimmed) return segments.join('/');
  const sep = trimmed.includes('\\') ? '\\' : '/';
  return [trimmed, ...segments].join(sep);
}

export function getDataDir(): string {
  return useSettingsStore.getState().dataDir.trim();
}

/** Data root for disk IO; falls back to default dir in Tauri when settings are empty. */
export async function resolveDataDir(): Promise<string> {
  let root = getDataDir();
  if (!root && isTauri()) {
    root = await invoke<string>('get_default_data_dir');
    useSettingsStore.getState().setDataDir(root);
  }
  return root;
}

export function getFoldersDir(): string {
  const root = getDataDir();
  return root ? joinPath(root, FOLDERS_SUBDIR) : '';
}
