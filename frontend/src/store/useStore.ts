import { create } from 'zustand';
import { nanoid } from 'nanoid';
import type { HttpRequest, HttpResponse, HistoryEntry, KeyValue } from '../types';
import type { RawContentType } from '../types';
import { inferRawContentType } from '../utils/curlUtils';

const defaultParams: KeyValue[] = [];
const defaultHeaders: KeyValue[] = [];

const defaultRequest: HttpRequest = {
  method: 'GET',
  url: '',
  params: [...defaultParams],
  headers: [...defaultHeaders],
  bodyType: 'none',
  rawContentType: 'json',
  body: '',
};

export type TabSource = 'collection' | 'history' | 'temporary';

export interface RequestTab {
  id: string;
  name: string;
  request: HttpRequest;
  response: HttpResponse | null;
  loading: boolean;
  sourceType: TabSource;
  sourcePath: string;
  unsaved: boolean;
  collectionId: string | null; // id of the collection node, for Cmd+S auto-save
}

interface AppState {
  tabs: RequestTab[];
  activeTabId: string | null;
  activeTab: 'params' | 'headers' | 'body';
  responseTab: 'body' | 'headers' | 'raw';
  history: HistoryEntry[];

  // Tab management
  createTab: () => void;
  closeTab: (id: string) => void;
  switchTab: (id: string) => void;
  switchToPreviousTab: () => void;
  switchToNextTab: () => void;
  openTabFromCollection: (req: HttpRequest, name: string, collectionPath: string, collectionId: string) => void;
  openTabFromHistory: (entry: HistoryEntry) => void;
  syncCollectionTabName: (collectionId: string, name: string) => void;
  linkActiveTabToCollection: (collectionId: string, name: string, sourcePath: string) => void;
  markUnsaved: () => void;
  clearUnsaved: () => void;

  // Request actions (operate on active tab)
  setMethod: (method: HttpRequest['method']) => void;
  setUrl: (url: string) => void;
  syncParamsFromUrl: () => void;
  syncUrlFromParams: () => void;
  updateParam: (index: number, field: 'key' | 'value', val: string) => void;
  addParam: () => void;
  removeParam: (index: number) => void;
  updateHeader: (index: number, field: 'key' | 'value', val: string) => void;
  addHeader: () => void;
  removeHeader: (index: number) => void;
  setBodyType: (bodyType: HttpRequest['bodyType']) => void;
  setRawContentType: (rawContentType: RawContentType) => void;
  setBody: (body: string) => void;
  applyParsedCurl: (parsed: {
    method: string;
    url: string;
    headers: [string, string][];
    body: string | null;
  }) => void;
  setActiveTab: (tab: AppState['activeTab']) => void;
  setResponseTab: (tab: AppState['responseTab']) => void;

  // Response actions
  setResponse: (res: HttpResponse) => void;
  setLoading: (loading: boolean) => void;

  // History actions
  addHistory: (entry: Omit<HistoryEntry, 'id' | 'time'>) => void;
  clearHistory: () => void;

  // Reset
  resetRequest: () => void;
}

function urlWithParams(url: string, params: KeyValue[]): string {
  const baseUrl = url.split('?')[0];
  const active = params.filter(p => p.key && p.enabled);
  if (active.length === 0) return baseUrl;
  const qs = active.map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&');
  return `${baseUrl}?${qs}`;
}

function parseParamsFromUrl(url: string): KeyValue[] {
  const qs = url.includes('?') ? url.split('?')[1] ?? '' : '';
  if (!qs) return [];
  const entries = new URLSearchParams(qs);
  const params: KeyValue[] = [];
  for (const [key, value] of entries.entries()) {
    params.push({ key, value: decodeURIComponent(value), enabled: true });
  }
  return params;
}

function newEmptyTab(): RequestTab {
  return {
    id: nanoid(),
    name: 'Untitled',
    request: { ...defaultRequest },
    response: null,
    loading: false,
    sourceType: 'temporary',
    sourcePath: '',
    unsaved: false,
    collectionId: null,
  };
}

function updateActiveTab(state: AppState, update: Partial<RequestTab>): AppState {
  if (!state.activeTabId) return state;
  return {
    ...state,
    tabs: state.tabs.map(t => t.id === state.activeTabId ? { ...t, ...update } : t),
  };
}

function activeRequest(state: AppState): HttpRequest | null {
  const tab = state.tabs.find(t => t.id === state.activeTabId);
  return tab?.request ?? null;
}

// Mark active tab as unsaved
function withUnsaved(state: AppState, update: Partial<RequestTab>): AppState {
  return updateActiveTab(state, { ...update, unsaved: true });
}

const initialTab = newEmptyTab();

export const useStore = create<AppState>((set, get) => ({
  tabs: [initialTab],
  activeTabId: initialTab.id,
  activeTab: 'params',
  responseTab: 'body',
  history: [],

  createTab: () => set(state => {
    const tab = newEmptyTab();
    return { tabs: [...state.tabs, tab], activeTabId: tab.id };
  }),

  closeTab: (id) => set(state => {
    const idx = state.tabs.findIndex(t => t.id === id);
    if (idx === -1) return state;
    const tabs = state.tabs.filter(t => t.id !== id);
    if (tabs.length === 0) {
      const tab = newEmptyTab();
      return { tabs: [tab], activeTabId: tab.id };
    }
    let activeTabId = state.activeTabId;
    if (state.activeTabId === id) {
      const nextIdx = Math.min(idx, tabs.length - 1);
      activeTabId = tabs[nextIdx].id;
    }
    return { tabs, activeTabId };
  }),

  switchTab: (id) => set({ activeTabId: id }),

  switchToPreviousTab: () => set(state => {
    if (state.tabs.length <= 1) return state;
    const idx = state.tabs.findIndex(t => t.id === state.activeTabId);
    const currentIdx = idx === -1 ? 0 : idx;
    if (currentIdx <= 0) return state;
    return { activeTabId: state.tabs[currentIdx - 1].id };
  }),

  switchToNextTab: () => set(state => {
    if (state.tabs.length <= 1) return state;
    const idx = state.tabs.findIndex(t => t.id === state.activeTabId);
    const currentIdx = idx === -1 ? 0 : idx;
    if (currentIdx >= state.tabs.length - 1) return state;
    return { activeTabId: state.tabs[currentIdx + 1].id };
  }),

  openTabFromCollection: (req, name, collectionPath, collectionId) => set(state => {
    // If already open, switch to existing tab instead of duplicating
    const existing = state.tabs.find(t => t.collectionId === collectionId);
    if (existing) {
      return {
        activeTabId: existing.id,
        tabs: state.tabs.map(t =>
          t.id === existing.id
            ? {
                ...t,
                name,
                sourcePath: collectionPath,
                sourceType: 'collection' as const,
                collectionId,
                request: {
                  method: req.method,
                  url: req.url,
                  params: req.params.map(p => ({ ...p })),
                  headers: req.headers.map(h => ({ ...h })),
                  bodyType: req.bodyType,
                  rawContentType: req.rawContentType,
                  body: req.body,
                },
                unsaved: false,
              }
            : t,
        ),
      };
    }

    const tab: RequestTab = {
      id: nanoid(),
      name,
      request: {
        method: req.method,
        url: req.url,
        params: req.params.map(p => ({ ...p })),
        headers: req.headers.map(h => ({ ...h })),
        bodyType: req.bodyType,
        rawContentType: req.rawContentType,
        body: req.body,
      },
      response: null,
      loading: false,
      sourceType: 'collection',
      sourcePath: collectionPath,
      unsaved: false,
      collectionId,
    };
    return { tabs: [...state.tabs, tab], activeTabId: tab.id };
  }),

  syncCollectionTabName: (collectionId, name) => set(state => ({
    tabs: state.tabs.map(t =>
      t.collectionId === collectionId ? { ...t, name } : t,
    ),
  })),

  linkActiveTabToCollection: (collectionId, name, sourcePath) => set(state =>
    updateActiveTab(state, {
      collectionId,
      name,
      sourcePath,
      sourceType: 'collection',
      unsaved: false,
    }),
  ),

  openTabFromHistory: (entry) => set(state => {
    const urlName = entry.url.split('?')[0].split('/').pop() || 'Request';
    const tab: RequestTab = {
      id: nanoid(),
      name: urlName,
      request: { ...entry.request },
      response: entry.response ? { ...entry.response } : null,
      loading: false,
      sourceType: 'history',
      sourcePath: 'History',
      unsaved: false,
      collectionId: null,
    };
    return { tabs: [...state.tabs, tab], activeTabId: tab.id };
  }),

  markUnsaved: () => set(state => {
    const tab = state.tabs.find(t => t.id === state.activeTabId);
    if (!tab || tab.sourceType !== 'collection') return state;
    return updateActiveTab(state, { unsaved: true });
  }),

  clearUnsaved: () => set(state => updateActiveTab(state, { unsaved: false })),

  setMethod: (method) => set(state => withUnsaved(state, { request: { ...activeRequest(state)!, method } })),

  setUrl: (url) => set(state => {
    const req = activeRequest(state)!;
    const params = parseParamsFromUrl(url);
    return withUnsaved(state, {
      request: {
        ...req,
        url,
        params: params.length > 0 ? params : req.params,
      },
    });
  }),

  syncParamsFromUrl: () => set(state => {
    const req = activeRequest(state)!;
    const params = parseParamsFromUrl(req.url);
    return updateActiveTab(state, { request: { ...req, params } });
  }),

  syncUrlFromParams: () => set(state => {
    const req = activeRequest(state)!;
    return updateActiveTab(state, { request: { ...req, url: urlWithParams(req.url, req.params) } });
  }),

  updateParam: (index, field, val) => set(state => {
    const req = activeRequest(state)!;
    const params = [...req.params];
    params[index] = { ...params[index], [field]: val };
    return withUnsaved(state, { request: { ...req, params } });
  }),

  addParam: () => set(state => {
    const req = activeRequest(state)!;
    return withUnsaved(state, { request: { ...req, params: [...req.params, { key: '', value: '', enabled: true }] } });
  }),

  removeParam: (index) => set(state => {
    const req = activeRequest(state)!;
    return withUnsaved(state, { request: { ...req, params: req.params.filter((_p: KeyValue, i: number) => i !== index) } });
  }),

  updateHeader: (index, field, val) => set(state => {
    const req = activeRequest(state)!;
    const headers = [...req.headers];
    headers[index] = { ...headers[index], [field]: val };
    return withUnsaved(state, { request: { ...req, headers } });
  }),

  addHeader: () => set(state => {
    const req = activeRequest(state)!;
    return withUnsaved(state, { request: { ...req, headers: [...req.headers, { key: '', value: '', enabled: true }] } });
  }),

  removeHeader: (index) => set(state => {
    const req = activeRequest(state)!;
    return withUnsaved(state, { request: { ...req, headers: req.headers.filter((_h: KeyValue, i: number) => i !== index) } });
  }),

  setBodyType: (bodyType) => set(state => withUnsaved(state, { request: { ...activeRequest(state)!, bodyType } })),
  setRawContentType: (rawContentType) => set(state => withUnsaved(state, { request: { ...activeRequest(state)!, rawContentType } })),
  setBody: (body) => set(state => withUnsaved(state, { request: { ...activeRequest(state)!, body } })),
  applyParsedCurl: (parsed) => set(state => {
    const req = activeRequest(state);
    if (!req) return state;
    const headers = parsed.headers.map(([key, value]) => ({ key, value, enabled: true }));
    const url = parsed.url;
    const params = parseParamsFromUrl(url);
    let bodyType: HttpRequest['bodyType'] = 'none';
    let rawContentType = req.rawContentType;
    let body = '';
    if (parsed.body) {
      bodyType = 'raw';
      body = parsed.body;
      const ct = headers.find(h => h.key.toLowerCase() === 'content-type')?.value ?? '';
      rawContentType = inferRawContentType(ct);
    }
    return updateActiveTab(state, {
      request: {
        ...req,
        method: parsed.method.toUpperCase() as HttpRequest['method'],
        url,
        params,
        headers,
        bodyType,
        rawContentType,
        body,
      },
      unsaved: true,
    });
  }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setResponseTab: (responseTab) => set({ responseTab }),

  setResponse: (response) => set(state => updateActiveTab(state, { response })),
  setLoading: (loading) => set(state => updateActiveTab(state, { loading })),

  addHistory: (entry) => set(state => ({
    history: [{ ...entry, id: nanoid(), time: new Date().toLocaleTimeString() }, ...state.history].slice(0, 50),
  })),

  clearHistory: () => set({ history: [] }),

  resetRequest: () => set(state => updateActiveTab(state, { request: { ...defaultRequest }, name: 'Untitled' })),
}));

// Selector: get the active tab
export function selectActiveTab(state: AppState): RequestTab | undefined {
  return state.tabs.find(t => t.id === state.activeTabId);
}
