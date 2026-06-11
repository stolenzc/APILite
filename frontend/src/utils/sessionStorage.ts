import { invoke } from '@tauri-apps/api/core';
import type { HttpRequest } from '../types';
import type { RequestTab, TabSource } from '../store/useStore';
import { useStore } from '../store/useStore';
import { getFolderPath, useFolderStore } from '../store/useFolderStore';
import { cloneHttpRequest, normalizeHttpRequest } from '../utils/normalizeRequest';
import { requestsEqual } from '../utils/requestEquality';
import { isTauri } from '../tauri/setupMenu';
import { getDataDir } from './storagePaths';

export const SESSION_STORAGE_KEY = 'APILite-session-v1';

const DEBOUNCE_MS = 400;

interface PersistedTab {
  id: string;
  name: string;
  request: HttpRequest;
  sourceType: TabSource;
  folderTreePath: string;
  unsaved: boolean;
  savedRequest: HttpRequest | null;
  requestNodeId: string | null;
}

export interface SessionSnapshot {
  version: 1;
  tabs: PersistedTab[];
  activeTabId: string | null;
  activeTab: 'params' | 'headers' | 'body' | 'script';
  responseTab: 'body' | 'headers' | 'raw';
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;
let lastSerialized = '';

function tabToPersisted(tab: RequestTab): PersistedTab {
  return {
    id: tab.id,
    name: tab.name,
    request: cloneHttpRequest(tab.request),
    sourceType: tab.sourceType,
    folderTreePath: tab.folderTreePath,
    unsaved: tab.unsaved,
    savedRequest: tab.savedRequest ? cloneHttpRequest(tab.savedRequest) : null,
    requestNodeId: tab.requestNodeId,
  };
}

function snapshotFromState(state: {
  tabs: RequestTab[];
  activeTabId: string | null;
  activeTab: SessionSnapshot['activeTab'];
  responseTab: SessionSnapshot['responseTab'];
}): SessionSnapshot {
  return {
    version: 1,
    tabs: state.tabs.map(tabToPersisted),
    activeTabId: state.activeTabId,
    activeTab: state.activeTab,
    responseTab: state.responseTab,
  };
}

function restoreTab(persisted: PersistedTab): RequestTab {
  const folders = useFolderStore.getState().folders;
  const request = normalizeHttpRequest(persisted.request);
  let {
    id,
    name,
    sourceType,
    folderTreePath,
    unsaved,
    savedRequest,
    requestNodeId,
  } = persisted;

  if (requestNodeId) {
    const node = useFolderStore.getState().getRequestNode(requestNodeId);
    if (node) {
      folderTreePath = getFolderPath(folders, requestNodeId);
      if (!unsaved) {
        name = node.name;
      }
      sourceType = 'folder';
    } else {
      sourceType = 'temporary';
      requestNodeId = null;
      folderTreePath = '';
    }
  }

  const normalizedSaved = savedRequest ? normalizeHttpRequest(savedRequest) : null;
  unsaved = normalizedSaved ? !requestsEqual(request, normalizedSaved) : true;

  return {
    id,
    name,
    request,
    response: null,
    loading: false,
    requestStartedAtMs: null,
    stream: null,
    sending: false,
    sourceType,
    folderTreePath,
    unsaved,
    savedRequest: normalizedSaved,
    requestNodeId,
    scriptVars: {},
  };
}

function parseSnapshot(raw: string): SessionSnapshot | null {
  try {
    const parsed = JSON.parse(raw) as Partial<SessionSnapshot>;
    if (parsed.version !== 1 || !Array.isArray(parsed.tabs)) return null;
    const tabs = parsed.tabs.filter(
      (t): t is PersistedTab =>
        !!t &&
        typeof t === 'object' &&
        typeof t.id === 'string' &&
        typeof t.name === 'string' &&
        t.request != null,
    );
    if (tabs.length === 0) return null;
    return {
      version: 1,
      tabs,
      activeTabId: typeof parsed.activeTabId === 'string' ? parsed.activeTabId : null,
      activeTab: parsed.activeTab ?? 'params',
      responseTab: parsed.responseTab ?? 'body',
    };
  } catch {
    return null;
  }
}

async function loadRawSession(): Promise<string | null> {
  if (isTauri()) {
    const dataDir = getDataDir();
    if (!dataDir) return null;
    return invoke<string | null>('session_load', { dataDir });
  }
  try {
    return localStorage.getItem(SESSION_STORAGE_KEY);
  } catch {
    return null;
  }
}

async function saveRawSession(raw: string): Promise<void> {
  if (isTauri()) {
    const dataDir = getDataDir();
    if (!dataDir) return;
    await invoke('session_save', { dataDir, data: raw });
    return;
  }
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, raw);
  } catch {
    /* quota or private mode */
  }
}

async function clearRawSession(): Promise<void> {
  if (isTauri()) {
    const dataDir = getDataDir();
    if (!dataDir) return;
    await invoke('session_clear', { dataDir }).catch((err) =>
      console.error('Failed to clear session on disk:', err),
    );
    return;
  }
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export async function persistSession(
  state: Parameters<typeof snapshotFromState>[0] = useStore.getState(),
): Promise<void> {
  if (state.tabs.length === 0) {
    lastSerialized = '';
    await clearRawSession();
    return;
  }

  const snapshot = snapshotFromState(state);
  const raw = JSON.stringify(snapshot);
  if (raw === lastSerialized) return;
  lastSerialized = raw;
  await saveRawSession(raw);
}

function schedulePersist(): void {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    void persistSession().catch((err) => console.error('Failed to persist session:', err));
  }, DEBOUNCE_MS);
}

export function flushSession(): void {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  void persistSession().catch((err) => console.error('Failed to flush session:', err));
}

/** Restore tabs from disk/localStorage after folders are loaded. */
export async function hydrateSessionFromStorage(): Promise<void> {
  const raw = await loadRawSession();
  if (!raw) return;

  const snapshot = parseSnapshot(raw);
  if (!snapshot) {
    await clearRawSession();
    return;
  }

  const tabs = snapshot.tabs.map(restoreTab);
  const activeTabId =
    snapshot.activeTabId && tabs.some((t) => t.id === snapshot.activeTabId)
      ? snapshot.activeTabId
      : tabs[0]?.id ?? null;

  useStore.setState({
    tabs,
    activeTabId,
    activeTab: snapshot.activeTab,
    responseTab: snapshot.responseTab,
  });
  lastSerialized = raw;
}

/** Subscribe to tab changes and persist with debounce. */
export function initSessionPersistence(): () => void {
  const unsub = useStore.subscribe((state, prev) => {
    if (
      state.tabs === prev.tabs &&
      state.activeTabId === prev.activeTabId &&
      state.activeTab === prev.activeTab &&
      state.responseTab === prev.responseTab
    ) {
      return;
    }
    schedulePersist();
  });

  const onPageHide = () => flushSession();
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('beforeunload', onPageHide);

  return () => {
    unsub();
    window.removeEventListener('pagehide', onPageHide);
    window.removeEventListener('beforeunload', onPageHide);
    if (persistTimer) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }
  };
}
