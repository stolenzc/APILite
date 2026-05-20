import { useSettingsStore } from '../store/useSettings';

export const COLLECTIONS_SUBDIR = 'collections';
export const ENVIRONMENTS_FILE = 'environments.json';

/** Join path segments using the separator style of the base path. */
export function joinPath(base: string, ...segments: string[]): string {
  const trimmed = base.replace(/[/\\]+$/, '');
  if (!trimmed) return segments.join('/');
  const sep = trimmed.includes('\\') ? '\\' : '/';
  return [trimmed, ...segments].join(sep);
}

/** Migrate legacy `collectionDir` (often …/collections) to data root. */
export function migrateStoragePath(parsed: {
  dataDir?: string;
  collectionDir?: string;
}): string {
  if (parsed.dataDir?.trim()) return parsed.dataDir.trim();
  const legacy = parsed.collectionDir?.trim();
  if (!legacy) return '';
  const normalized = legacy.replace(/\\/g, '/').replace(/\/+$/, '');
  if (normalized.endsWith(`/${COLLECTIONS_SUBDIR}`)) {
    return legacy.replace(/[/\\]collections[/\\]?$/i, '').replace(/[/\\]+$/, '');
  }
  return legacy;
}

export function getDataDir(): string {
  return useSettingsStore.getState().dataDir.trim();
}

export function getCollectionsDir(): string {
  const root = getDataDir();
  return root ? joinPath(root, COLLECTIONS_SUBDIR) : '';
}

export function getEnvironmentsFilePath(): string {
  const root = getDataDir();
  return root ? joinPath(root, ENVIRONMENTS_FILE) : '';
}
