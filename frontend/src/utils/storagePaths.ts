import { useSettingsStore } from '../store/useSettings';

export const FOLDERS_SUBDIR = 'folders';
export const HISTORIES_SUBDIR = 'histories';
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

export function getFoldersDir(): string {
  const root = getDataDir();
  return root ? joinPath(root, FOLDERS_SUBDIR) : '';
}
