import { create } from 'zustand';
import { nanoid } from 'nanoid';
import type {
  BinaryBodyFile,
  FormField,
  FormFieldType,
  HttpRequest,
  HttpResponse,
  HistoryEntry,
  KeyValue,
} from '../types';
import type { RawContentType } from '../types';
import { cloneHttpRequest, emptyFormField, emptyKeyValue, normalizeHttpRequest } from '../utils/normalizeRequest';
import { inferRawContentType } from '../utils/curlUtils';
import { parseParamsFromUrl, urlWithParams } from '../utils/urlQuery';
import { dispatchFocusUrl } from '../utils/focusUrl';
import {
  applyHistoryRetentionToStorage,
  formatHistoryDisplayTime,
  getHistoryRetention,
  clearPersistedHistory,
  loadHistoryPage,
  loadInitialHistoryPage,
  persistHistoryAppend,
  pruneHistory,
} from '../utils/historyStorage';

const defaultRequest: HttpRequest = normalizeHttpRequest({
  method: 'GET',
  url: '',
});

export type TabSource = 'collection' | 'temporary';

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
  historyHasMore: boolean;
  historyLoadingMore: boolean;

  // Tab management
  createTab: () => void;
  closeTab: (id: string) => void;
  switchTab: (id: string) => void;
  switchToPreviousTab: () => void;
  switchToNextTab: () => void;
  openTabFromCollection: (req: HttpRequest, name: string, collectionPath: string, collectionId: string) => void;
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
  updateFormField: (index: number, field: 'key' | 'value' | 'enabled', val: string | boolean) => void;
  setFormFieldType: (index: number, fieldType: FormFieldType) => void;
  setFormFieldFile: (
    index: number,
    file: { fileName: string; filePath?: string; fileDataBase64?: string; value?: string },
  ) => void;
  clearFormFieldFile: (index: number) => void;
  addFormField: () => void;
  removeFormField: (index: number) => void;
  updateUrlEncodedField: (index: number, field: 'key' | 'value' | 'enabled', val: string | boolean) => void;
  addUrlEncodedField: () => void;
  removeUrlEncodedField: (index: number) => void;
  setBinaryFile: (file: BinaryBodyFile | null) => void;
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
  addHistory: (entry: Omit<HistoryEntry, 'id' | 'time' | 'timestamp'>) => void;
  loadMoreHistory: () => Promise<void>;
  clearHistory: () => void;
  syncHistoryRetention: () => void;

  // Reset
  resetRequest: () => void;
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
  if (!state.activeTabId || !activeRequest(state)) return state;
  return updateActiveTab(state, { ...update, unsaved: true });
}

function applyParsedToRequest(req: HttpRequest, parsed: {
  method: string;
  url: string;
  headers: [string, string][];
  body: string | null;
}): HttpRequest {
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
  return normalizeHttpRequest({
    ...req,
    method: parsed.method.toUpperCase() as HttpRequest['method'],
    url,
    params,
    headers,
    bodyType,
    rawContentType,
    body,
  });
}

const initialHistoryPage = loadInitialHistoryPage();

export const useStore = create<AppState>((set, get) => ({
  tabs: [],
  activeTabId: null,
  activeTab: 'params',
  responseTab: 'body',
  history: initialHistoryPage.entries,
  historyHasMore: initialHistoryPage.hasMore,
  historyLoadingMore: false,

  createTab: () => {
    set(state => {
      const tab = newEmptyTab();
      return { tabs: [...state.tabs, tab], activeTabId: tab.id };
    });
    queueMicrotask(() => dispatchFocusUrl());
  },

  closeTab: (id) => set(state => {
    const idx = state.tabs.findIndex(t => t.id === id);
    if (idx === -1) return state;
    const tabs = state.tabs.filter(t => t.id !== id);
    if (tabs.length === 0) {
      return { tabs: [], activeTabId: null };
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
    if (state.tabs.length < 2) return state;
    const idx = state.tabs.findIndex(t => t.id === state.activeTabId);
    const currentIdx = idx === -1 ? 0 : idx;
    if (currentIdx <= 0) return state;
    return { activeTabId: state.tabs[currentIdx - 1].id };
  }),

  switchToNextTab: () => set(state => {
    if (state.tabs.length < 2) return state;
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
                request: cloneHttpRequest(req),
                unsaved: false,
              }
            : t,
        ),
      };
    }

    const tab: RequestTab = {
      id: nanoid(),
      name,
      request: cloneHttpRequest(req),
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

  markUnsaved: () => set(state => {
    const tab = state.tabs.find(t => t.id === state.activeTabId);
    if (!tab || tab.sourceType !== 'collection') return state;
    return updateActiveTab(state, { unsaved: true });
  }),

  clearUnsaved: () => set(state => updateActiveTab(state, { unsaved: false })),

  setMethod: (method) => set(state => {
    const req = activeRequest(state);
    if (!req) return state;
    return withUnsaved(state, { request: { ...req, method } });
  }),

  setUrl: (url) => set(state => {
    const req = activeRequest(state);
    if (!req) return state;
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
    const req = activeRequest(state);
    if (!req) return state;
    const params = parseParamsFromUrl(req.url);
    return updateActiveTab(state, { request: { ...req, params } });
  }),

  syncUrlFromParams: () => set(state => {
    const req = activeRequest(state);
    if (!req) return state;
    return updateActiveTab(state, { request: { ...req, url: urlWithParams(req.url, req.params) } });
  }),

  updateParam: (index, field, val) => set(state => {
    const req = activeRequest(state);
    if (!req) return state;
    const params = [...req.params];
    params[index] = { ...params[index], [field]: val };
    return withUnsaved(state, { request: { ...req, params } });
  }),

  addParam: () => set(state => {
    const req = activeRequest(state);
    if (!req) return state;
    return withUnsaved(state, { request: { ...req, params: [...req.params, { key: '', value: '', enabled: true }] } });
  }),

  removeParam: (index) => set(state => {
    const req = activeRequest(state);
    if (!req) return state;
    return withUnsaved(state, { request: { ...req, params: req.params.filter((_p: KeyValue, i: number) => i !== index) } });
  }),

  updateHeader: (index, field, val) => set(state => {
    const req = activeRequest(state);
    if (!req) return state;
    const headers = [...req.headers];
    headers[index] = { ...headers[index], [field]: val };
    return withUnsaved(state, { request: { ...req, headers } });
  }),

  addHeader: () => set(state => {
    const req = activeRequest(state);
    if (!req) return state;
    return withUnsaved(state, { request: { ...req, headers: [...req.headers, { key: '', value: '', enabled: true }] } });
  }),

  removeHeader: (index) => set(state => {
    const req = activeRequest(state);
    if (!req) return state;
    return withUnsaved(state, { request: { ...req, headers: req.headers.filter((_h: KeyValue, i: number) => i !== index) } });
  }),

  setBodyType: (bodyType) => set(state => {
    const req = activeRequest(state);
    if (!req) return state;
    return withUnsaved(state, { request: { ...req, bodyType } });
  }),
  setRawContentType: (rawContentType) => set(state => {
    const req = activeRequest(state);
    if (!req) return state;
    return withUnsaved(state, { request: { ...req, rawContentType } });
  }),
  setBody: (body) => set(state => {
    const req = activeRequest(state);
    if (!req) return state;
    return withUnsaved(state, { request: { ...req, body } });
  }),

  updateFormField: (index, field, val) => set(state => {
    const req = activeRequest(state);
    if (!req) return state;
    const formFields = [...req.formFields];
    formFields[index] = { ...formFields[index], [field]: val } as FormField;
    return withUnsaved(state, { request: { ...req, formFields } });
  }),

  setFormFieldType: (index, fieldType) => set(state => {
    const req = activeRequest(state);
    if (!req) return state;
    const formFields = [...req.formFields];
    const row = { ...formFields[index], fieldType };
    if (fieldType === 'text') {
      row.fileName = undefined;
      row.filePath = undefined;
      row.fileDataBase64 = undefined;
    } else {
      row.value = row.fileName ?? '';
    }
    formFields[index] = row;
    return withUnsaved(state, { request: { ...req, formFields } });
  }),

  setFormFieldFile: (index, file) => set(state => {
    const req = activeRequest(state);
    if (!req) return state;
    const formFields = [...req.formFields];
    formFields[index] = {
      ...formFields[index],
      fieldType: 'file',
      fileName: file.fileName,
      filePath: file.filePath,
      fileDataBase64: file.fileDataBase64,
      value: file.value ?? file.fileName,
    };
    return withUnsaved(state, { request: { ...req, formFields } });
  }),

  clearFormFieldFile: (index) => set(state => {
    const req = activeRequest(state);
    if (!req) return state;
    const formFields = [...req.formFields];
    formFields[index] = {
      ...formFields[index],
      value: '',
      fileName: undefined,
      filePath: undefined,
      fileDataBase64: undefined,
    };
    return withUnsaved(state, { request: { ...req, formFields } });
  }),

  addFormField: () => set(state => {
    const req = activeRequest(state);
    if (!req) return state;
    return withUnsaved(state, {
      request: { ...req, formFields: [...req.formFields, emptyFormField()] },
    });
  }),

  removeFormField: (index) => set(state => {
    const req = activeRequest(state);
    if (!req) return state;
    const formFields = req.formFields.filter((_f, i) => i !== index);
    return withUnsaved(state, {
      request: { ...req, formFields: formFields.length ? formFields : [emptyFormField()] },
    });
  }),

  updateUrlEncodedField: (index, field, val) => set(state => {
    const req = activeRequest(state);
    if (!req) return state;
    const urlEncodedFields = [...req.urlEncodedFields];
    urlEncodedFields[index] = { ...urlEncodedFields[index], [field]: val } as KeyValue;
    return withUnsaved(state, { request: { ...req, urlEncodedFields } });
  }),

  addUrlEncodedField: () => set(state => {
    const req = activeRequest(state);
    if (!req) return state;
    return withUnsaved(state, {
      request: { ...req, urlEncodedFields: [...req.urlEncodedFields, emptyKeyValue()] },
    });
  }),

  removeUrlEncodedField: (index) => set(state => {
    const req = activeRequest(state);
    if (!req) return state;
    const urlEncodedFields = req.urlEncodedFields.filter((_f, i) => i !== index);
    return withUnsaved(state, {
      request: {
        ...req,
        urlEncodedFields: urlEncodedFields.length ? urlEncodedFields : [emptyKeyValue()],
      },
    });
  }),

  setBinaryFile: (binaryFile) => set(state => {
    const req = activeRequest(state);
    if (!req) return state;
    return withUnsaved(state, { request: { ...req, binaryFile } });
  }),

  applyParsedCurl: (parsed) => set(state => {
    if (!state.activeTabId) {
      const tab = newEmptyTab();
      return {
        tabs: [{ ...tab, request: applyParsedToRequest(tab.request, parsed), unsaved: true }],
        activeTabId: tab.id,
      };
    }
    const req = activeRequest(state);
    if (!req) return state;
    return updateActiveTab(state, {
      request: applyParsedToRequest(req, parsed),
      unsaved: true,
    });
  }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setResponseTab: (responseTab) => set({ responseTab }),

  setResponse: (response) => set(state => updateActiveTab(state, { response })),
  setLoading: (loading) => set(state => updateActiveTab(state, { loading })),

  addHistory: (entry) => {
    const timestamp = Date.now();
    const newEntry: HistoryEntry = {
      ...entry,
      id: nanoid(),
      timestamp,
      time: formatHistoryDisplayTime(timestamp),
    };
    set((state) => {
      const next = pruneHistory([newEntry, ...state.history], getHistoryRetention());
      return { history: next };
    });
    void persistHistoryAppend(newEntry).catch((err) =>
      console.error('Failed to persist history entry:', err),
    );
  },

  loadMoreHistory: async () => {
    const { history, historyHasMore, historyLoadingMore } = get();
    if (!historyHasMore || historyLoadingMore) return;
    set({ historyLoadingMore: true });
    try {
      const page = await loadHistoryPage(history.length);
      const existingIds = new Set(history.map((e) => e.id));
      const fresh = page.entries.filter((e) => !existingIds.has(e.id));
      set((state) => ({
        history: [...state.history, ...fresh],
        historyHasMore: page.hasMore,
        historyLoadingMore: false,
      }));
    } catch (err) {
      console.error('Failed to load more history:', err);
      set({ historyLoadingMore: false });
    }
  },

  clearHistory: () => {
    clearPersistedHistory();
    set({ history: [], historyHasMore: false, historyLoadingMore: false });
  },

  syncHistoryRetention: () => {
    void applyHistoryRetentionToStorage()
      .then((page) => {
        set({
          history: page.entries,
          historyHasMore: page.hasMore,
          historyLoadingMore: false,
        });
      })
      .catch((err) => console.error('Failed to sync history retention:', err));
  },

  resetRequest: () => set(state => updateActiveTab(state, { request: { ...defaultRequest }, name: 'Untitled' })),
}));

// Selector: get the active tab
export function selectActiveTab(state: AppState): RequestTab | undefined {
  return state.tabs.find(t => t.id === state.activeTabId);
}
