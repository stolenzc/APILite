import { invoke } from '@tauri-apps/api/core';
import type { HistoryEntry } from '../types';
import { useSettingsStore } from '../store/useSettings';
import { isTauri } from '../tauri/setupMenu';
import { getDataDir } from './storagePaths';

export const HISTORY_STORAGE_KEY = 'APILite-history-v1';

/** Daily shard file name under `histories/`. */
export const HISTORY_DAY_FILE_PATTERN = 'YYYY-MM-DD.json';

/** Default / per-page size for in-app history list. */
export const HISTORY_PAGE_SIZE = 50;

export interface HistoryRetention {
  maxAgeDays: number;
  maxCount: number;
}

export interface HistoryPage {
  entries: HistoryEntry[];
  hasMore: boolean;
  total: number;
}

export const defaultHistoryRetention: HistoryRetention = {
  maxAgeDays: 30,
  maxCount: 1000,
};

export function getHistoryRetention(): HistoryRetention {
  const { historyMaxAgeDays, historyMaxCount } = useSettingsStore.getState();
  return { maxAgeDays: historyMaxAgeDays, maxCount: historyMaxCount };
}

export function formatHistoryDisplayTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

/** Local calendar day key for sharding (`YYYY-MM-DD`). */
export function dayKeyFromTimestamp(timestamp: number): string {
  const d = new Date(timestamp);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function groupEntriesByDay(entries: HistoryEntry[]): Record<string, HistoryEntry[]> {
  const byDay: Record<string, HistoryEntry[]> = {};
  for (const entry of entries) {
    const day = dayKeyFromTimestamp(entry.timestamp ?? Date.now());
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(entry);
  }
  for (const day of Object.keys(byDay)) {
    byDay[day].sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
  }
  return byDay;
}

/** Days whose on-disk shard may have changed between two snapshots. */
export function getDirtyDays(before: HistoryEntry[], after: HistoryEntry[]): Set<string> {
  const days = new Set<string>();
  for (const e of before) days.add(dayKeyFromTimestamp(e.timestamp ?? 0));
  for (const e of after) days.add(dayKeyFromTimestamp(e.timestamp ?? 0));
  return days;
}

function normalizeEntries(entries: unknown[]): HistoryEntry[] {
  const now = Date.now();
  return entries
    .filter((e): e is HistoryEntry => !!e && typeof e === 'object' && 'id' in e)
    .map((e, index) => {
      const timestamp =
        typeof e.timestamp === 'number' && Number.isFinite(e.timestamp)
          ? e.timestamp
          : now - index;
      return {
        ...e,
        timestamp,
        time:
          typeof e.time === 'string' && e.time
            ? e.time
            : formatHistoryDisplayTime(timestamp),
      };
    });
}

/** Drop entries older than maxAgeDays, then keep newest maxCount items. */
export function pruneHistory(
  entries: HistoryEntry[],
  retention: HistoryRetention = getHistoryRetention(),
): HistoryEntry[] {
  const { maxAgeDays, maxCount } = retention;
  const minTs = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  const withinAge = entries.filter((e) => (e.timestamp ?? 0) >= minTs);
  const sorted = [...withinAge].sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
  return sorted.slice(0, maxCount);
}

function parseHistoryJson(raw: string): HistoryEntry[] | null {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return normalizeEntries(parsed);
  } catch {
    return null;
  }
}

function sortNewestFirst(entries: HistoryEntry[]): HistoryEntry[] {
  return [...entries].sort((a, b) => {
    const diff = (b.timestamp ?? 0) - (a.timestamp ?? 0);
    if (diff !== 0) return diff;
    return a.id.localeCompare(b.id);
  });
}

function pageFromSorted(sorted: HistoryEntry[], offset: number, limit: number): HistoryPage {
  const total = sorted.length;
  const entries = sorted.slice(offset, offset + limit);
  return { entries, hasMore: total > offset + limit, total };
}

/** Full list from localStorage (browser cache), pruned by retention. */
export function loadFullFromLocalStoragePruned(): HistoryEntry[] {
  return pruneHistory(loadFullFromLocalStorageRaw());
}

function loadFullFromLocalStorageRaw(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    return parseHistoryJson(raw) ?? [];
  } catch {
    return [];
  }
}

export function loadInitialHistoryPage(): HistoryPage {
  const pruned = loadFullFromLocalStoragePruned();
  return pageFromSorted(pruned, 0, HISTORY_PAGE_SIZE);
}

export async function loadHistoryPage(offset: number): Promise<HistoryPage> {
  const retention = getHistoryRetention();
  const limit = HISTORY_PAGE_SIZE;

  if (isTauri()) {
    const dataDir = getDataDir();
    if (!dataDir) return { entries: [], hasMore: false, total: 0 };
    const result = await invoke<{
      entries: string;
      has_more: boolean;
      total: number;
    }>('histories_load_page', {
      dataDir,
      maxAgeDays: retention.maxAgeDays,
      offset,
      limit,
    });
    const entries = parseHistoryJson(result.entries) ?? [];
    return {
      entries,
      hasMore: result.has_more,
      total: result.total,
    };
  }

  const pruned = loadFullFromLocalStoragePruned();
  return pageFromSorted(pruned, offset, limit);
}

export async function loadFullHistory(): Promise<HistoryEntry[]> {
  const retention = getHistoryRetention();
  if (isTauri()) {
    const dataDir = getDataDir();
    if (!dataDir) return [];
    const rawOpt = await invoke<string | null>('histories_load', {
      dataDir,
      maxAgeDays: retention.maxAgeDays,
    });
    if (rawOpt == null || rawOpt === '') return [];
    return pruneHistory(parseHistoryJson(rawOpt) ?? [], retention);
  }
  return loadFullFromLocalStoragePruned();
}

function saveToLocalStorage(entries: HistoryEntry[]): void {
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    /* quota or private mode */
  }
}

function buildDiskSyncPayload(
  entries: HistoryEntry[],
  before?: HistoryEntry[],
): { updates: Record<string, string>; keepDays: string[]; maxAgeDays: number } {
  const { maxAgeDays } = getHistoryRetention();
  const byDay = groupEntriesByDay(entries);
  const keepDays = Object.keys(byDay);
  const dirty = before != null ? getDirtyDays(before, entries) : new Set(keepDays);
  const updates: Record<string, string> = {};
  for (const day of dirty) {
    updates[day] = JSON.stringify(byDay[day] ?? []);
  }
  return { updates, keepDays, maxAgeDays };
}

function saveToDisk(entries: HistoryEntry[], before?: HistoryEntry[]): void {
  const dataDir = getDataDir();
  if (!isTauri() || !dataDir) return;
  const { updates, keepDays, maxAgeDays } = buildDiskSyncPayload(entries, before);
  void invoke('histories_sync', {
    dataDir,
    updates,
    keepDays,
    maxAgeDays,
  }).catch((err) => console.error('Failed to sync history to disk:', err));
}

export interface SaveHistoryOptions {
  /** When set, only rewrite day shards that changed (faster on append). */
  before?: HistoryEntry[];
}

export function savePersistedHistory(entries: HistoryEntry[], options?: SaveHistoryOptions): void {
  saveToLocalStorage(entries);
  saveToDisk(entries, options?.before);
}

export async function saveFullHistory(entries: HistoryEntry[]): Promise<void> {
  savePersistedHistory(entries);
}

/** Merge a new entry into the full persisted history (does not expand the UI list). */
export async function persistHistoryAppend(newEntry: HistoryEntry): Promise<void> {
  const retention = getHistoryRetention();
  const full = await loadFullHistory();
  const withoutDup = full.filter((e) => e.id !== newEntry.id);
  const next = pruneHistory([newEntry, ...withoutDup], retention);
  savePersistedHistory(next);
}

export function clearPersistedHistory(): void {
  try {
    localStorage.removeItem(HISTORY_STORAGE_KEY);
  } catch {
    /* ignore */
  }
  const dataDir = getDataDir();
  if (isTauri() && dataDir) {
    void invoke('histories_clear', { dataDir }).catch((err) =>
      console.error('Failed to clear history on disk:', err),
    );
  }
}

/** Tauri: first page from disk only (remaining pages load on demand). */
export async function hydrateHistoryFromDisk(): Promise<HistoryPage | null> {
  if (!isTauri()) return null;
  const dataDir = getDataDir();
  if (!dataDir) return null;
  try {
    const page = await loadHistoryPage(0);
    if (page.entries.length === 0 && !page.hasMore) return null;
    return page;
  } catch (err) {
    console.error('Failed to hydrate history from disk:', err);
    return null;
  }
}

/** Re-apply retention to disk and return the first UI page. */
export async function applyHistoryRetentionToStorage(): Promise<HistoryPage> {
  const full = await loadFullHistory();
  const pruned = pruneHistory(full);
  await saveFullHistory(pruned);
  return pageFromSorted(pruned, 0, HISTORY_PAGE_SIZE);
}
