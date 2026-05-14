import { create } from 'zustand';
import { nanoid } from 'nanoid';
import type { HttpRequest, HttpResponse, HistoryEntry, KeyValue } from '../types';
import type { RawContentType } from '../types';

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

export interface RequestTab {
  id: string;
  name: string;
  request: HttpRequest;
  response: HttpResponse | null;
  loading: boolean;
}

interface AppState {
  tabs: RequestTab[];
  activeTabId: string | null;
  activeTab: 'params' | 'headers' | 'body';
  responseTab: 'body' | 'headers';
  history: HistoryEntry[];

  // Tab management
  createTab: () => void;
  closeTab: (id: string) => void;
  switchTab: (id: string) => void;

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
  setActiveTab: (tab: AppState['activeTab']) => void;
  setResponseTab: (tab: AppState['responseTab']) => void;

  // Response actions
  setResponse: (res: HttpResponse) => void;
  setLoading: (loading: boolean) => void;

  // History actions
  addHistory: (entry: Omit<HistoryEntry, 'id' | 'time'>) => void;
  clearHistory: () => void;
  loadFromHistory: (entry: HistoryEntry) => void;

  // Load request into active tab
  loadRequest: (req: HttpRequest, name?: string) => void;

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
    name: 'New Tab',
    request: { ...defaultRequest },
    response: null,
    loading: false,
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
      // Always keep at least one tab
      const tab = newEmptyTab();
      return { tabs: [tab], activeTabId: tab.id };
    }
    let activeTabId = state.activeTabId;
    if (state.activeTabId === id) {
      // Switch to nearest neighbor
      const nextIdx = Math.min(idx, tabs.length - 1);
      activeTabId = tabs[nextIdx].id;
    }
    return { tabs, activeTabId };
  }),

  switchTab: (id) => set({ activeTabId: id }),

  setMethod: (method) => set(state => updateActiveTab(state, { request: { ...activeRequest(state)!, method } })),

  setUrl: (url) => set(state => {
    const req = activeRequest(state)!;
    const params = parseParamsFromUrl(url);
    return updateActiveTab(state, {
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
    return updateActiveTab(state, { request: { ...req, params } });
  }),

  addParam: () => set(state => {
    const req = activeRequest(state)!;
    return updateActiveTab(state, { request: { ...req, params: [...req.params, { key: '', value: '', enabled: true }] } });
  }),

  removeParam: (index) => set(state => {
    const req = activeRequest(state)!;
    return updateActiveTab(state, { request: { ...req, params: req.params.filter((_p: KeyValue, i: number) => i !== index) } });
  }),

  updateHeader: (index, field, val) => set(state => {
    const req = activeRequest(state)!;
    const headers = [...req.headers];
    headers[index] = { ...headers[index], [field]: val };
    return updateActiveTab(state, { request: { ...req, headers } });
  }),

  addHeader: () => set(state => {
    const req = activeRequest(state)!;
    return updateActiveTab(state, { request: { ...req, headers: [...req.headers, { key: '', value: '', enabled: true }] } });
  }),

  removeHeader: (index) => set(state => {
    const req = activeRequest(state)!;
    return updateActiveTab(state, { request: { ...req, headers: req.headers.filter((_h: KeyValue, i: number) => i !== index) } });
  }),

  setBodyType: (bodyType) => set(state => updateActiveTab(state, { request: { ...activeRequest(state)!, bodyType } })),
  setRawContentType: (rawContentType) => set(state => updateActiveTab(state, { request: { ...activeRequest(state)!, rawContentType } })),
  setBody: (body) => set(state => updateActiveTab(state, { request: { ...activeRequest(state)!, body } })),
  setActiveTab: (activeTab) => set({ activeTab }),
  setResponseTab: (responseTab) => set({ responseTab }),

  setResponse: (response) => set(state => updateActiveTab(state, { response })),
  setLoading: (loading) => set(state => updateActiveTab(state, { loading })),

  addHistory: (entry) => set(state => ({
    history: [{ ...entry, id: nanoid(), time: new Date().toLocaleTimeString() }, ...state.history].slice(0, 50),
  })),

  clearHistory: () => set({ history: [] }),

  loadFromHistory: (entry) => set(state => {
    if (!state.activeTabId) return state;
    return updateActiveTab(state, {
      request: { ...entry.request },
      response: entry.response ? { ...entry.response } : null,
      name: entry.url.split('?')[0].split('/').pop() || 'Request',
    });
  }),

  loadRequest: (req, name) => set(state => {
    const tabName = name ?? (req.url ? req.url.split('?')[0].split('/').pop() : 'Request');
    return updateActiveTab(state, {
      name: tabName,
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
    });
  }),

  resetRequest: () => set(state => updateActiveTab(state, { request: { ...defaultRequest }, name: 'New Tab' })),
}));

// Selector: get the active tab
export function selectActiveTab(state: AppState): RequestTab | undefined {
  return state.tabs.find(t => t.id === state.activeTabId);
}
