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
import { withTrailingEmptyRow, withTrailingFormFieldRow } from '../utils/kvRows';
import { requestsEqual } from '../utils/requestEquality';
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

export type TabSource = 'folder' | 'temporary';

export interface RequestTab {
  id: string;
  name: string;
  request: HttpRequest;
  response: HttpResponse | null;
  loading: boolean;
  sourceType: TabSource;
  sourcePath: string;
  unsaved: boolean;
  /** Request snapshot when opened or last saved; used to clear unsaved after revert. */
  savedRequest: HttpRequest | null;
  requestNodeId: string | null; // id of the saved request node in the folder tree, for Cmd+S auto-save
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
  openTabFromFolder: (req: HttpRequest, name: string, folderPath: string, requestNodeId: string) => void;
  syncFolderTabName: (requestNodeId: string, name: string) => void;
  linkActiveTabToFolder: (requestNodeId: string, name: string, sourcePath: string) => void;
  markUnsaved: () => void;
  clearUnsaved: () => void;

  // Request actions (operate on active tab)
  setMethod: (method: HttpRequest['method']) => void;
  setUrl: (url: string) => void;
  syncParamsFromUrl: () => void;
  syncUrlFromParams: () => void;
  updateParam: (index: number, field: 'key' | 'value' | 'enabled', val: string | boolean) => void;
  removeParam: (index: number) => void;
  updateHeader: (index: number, field: 'key' | 'value' | 'enabled', val: string | boolean) => void;
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
  removeFormField: (index: number) => void;
  updateUrlEncodedField: (index: number, field: 'key' | 'value' | 'enabled', val: string | boolean) => void;
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
    savedRequest: cloneHttpRequest(defaultRequest),
    requestNodeId: null,
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

function computeUnsaved(tab: RequestTab, request: HttpRequest): boolean {
  if (!tab.savedRequest) return true;
  return !requestsEqual(request, tab.savedRequest);
}

function withRequestUpdate(state: AppState, request: HttpRequest): AppState {
  if (!state.activeTabId) return state;
  const tab = state.tabs.find((t) => t.id === state.activeTabId);
  if (!tab) return state;
  return updateActiveTab(state, {
    request,
    unsaved: computeUnsaved(tab, request),
  });
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

  openTabFromFolder: (req, name, folderPath, requestNodeId) => set(state => {
    const existing = state.tabs.find(t => t.requestNodeId === requestNodeId);
    if (existing) {
      return {
        activeTabId: existing.id,
        tabs: state.tabs.map(t =>
          t.id === existing.id
            ? {
                ...t,
                name,
                sourcePath: folderPath,
                sourceType: 'folder' as const,
                requestNodeId,
                request: cloneHttpRequest(req),
                savedRequest: cloneHttpRequest(req),
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
      sourceType: 'folder',
      sourcePath: folderPath,
      unsaved: false,
      savedRequest: cloneHttpRequest(req),
      requestNodeId,
    };
    return { tabs: [...state.tabs, tab], activeTabId: tab.id };
  }),

  syncFolderTabName: (requestNodeId, name) => set(state => ({
    tabs: state.tabs.map(t =>
      t.requestNodeId === requestNodeId ? { ...t, name } : t,
    ),
  })),

  linkActiveTabToFolder: (requestNodeId, name, sourcePath) => set(state => {
    const tab = state.tabs.find((t) => t.id === state.activeTabId);
    if (!tab) return state;
    return updateActiveTab(state, {
      requestNodeId,
      name,
      sourcePath,
      sourceType: 'folder',
      unsaved: false,
      savedRequest: cloneHttpRequest(tab.request),
    });
  }),

  markUnsaved: () => set(state => {
    const tab = state.tabs.find((t) => t.id === state.activeTabId);
    if (!tab) return state;
    return updateActiveTab(state, { unsaved: computeUnsaved(tab, tab.request) });
  }),

  clearUnsaved: () => set(state => {
    const tab = state.tabs.find((t) => t.id === state.activeTabId);
    if (!tab) return state;
    return updateActiveTab(state, {
      unsaved: false,
      savedRequest: cloneHttpRequest(tab.request),
    });
  }),

  setMethod: (method) => set(state => {
    const req = activeRequest(state);
    if (!req) return state;
    return withRequestUpdate(state, { ...req, method });
  }),

  setUrl: (url) => set(state => {
    const req = activeRequest(state);
    if (!req) return state;
    const parsed = parseParamsFromUrl(url);
    const params = parsed.length > 0
      ? withTrailingEmptyRow(parsed, emptyKeyValue)
      : req.params;
    return withRequestUpdate(state, { ...req, url, params });
  }),

  syncParamsFromUrl: () => set(state => {
    const req = activeRequest(state);
    if (!req) return state;
    const params = withTrailingEmptyRow(parseParamsFromUrl(req.url), emptyKeyValue);
    return withRequestUpdate(state, { ...req, params });
  }),

  syncUrlFromParams: () => set(state => {
    const req = activeRequest(state);
    if (!req) return state;
    return withRequestUpdate(state, { ...req, url: urlWithParams(req.url, req.params) });
  }),

  updateParam: (index: number, field: 'key' | 'value' | 'enabled', val: string | boolean) => set(state => {
    const req = activeRequest(state);
    if (!req) return state;
    const params = withTrailingEmptyRow(
      req.params.map((p, i) => (i === index ? { ...p, [field]: val } : p)),
      emptyKeyValue,
    );
    const request = {
      ...req,
      params,
      url: urlWithParams(req.url, params),
    };
    return withRequestUpdate(state, request);
  }),

  removeParam: (index) => set(state => {
    const req = activeRequest(state);
    if (!req) return state;
    const params = withTrailingEmptyRow(
      req.params.filter((_p: KeyValue, i: number) => i !== index),
      emptyKeyValue,
    );
    return withRequestUpdate(state, { ...req, params, url: urlWithParams(req.url, params) });
  }),

  updateHeader: (index: number, field: 'key' | 'value' | 'enabled', val: string | boolean) => set(state => {
    const req = activeRequest(state);
    if (!req) return state;
    const headers = withTrailingEmptyRow(
      req.headers.map((h, i) => (i === index ? { ...h, [field]: val } : h)),
      emptyKeyValue,
    );
    return withRequestUpdate(state, { ...req, headers });
  }),

  removeHeader: (index) => set(state => {
    const req = activeRequest(state);
    if (!req) return state;
    const headers = withTrailingEmptyRow(
      req.headers.filter((_h: KeyValue, i: number) => i !== index),
      emptyKeyValue,
    );
    return withRequestUpdate(state, { ...req, headers });
  }),

  setBodyType: (bodyType) => set(state => {
    const req = activeRequest(state);
    if (!req) return state;
    return withRequestUpdate(state, { ...req, bodyType });
  }),
  setRawContentType: (rawContentType) => set(state => {
    const req = activeRequest(state);
    if (!req) return state;
    return withRequestUpdate(state, { ...req, rawContentType });
  }),
  setBody: (body) => set(state => {
    const req = activeRequest(state);
    if (!req) return state;
    return withRequestUpdate(state, { ...req, body });
  }),

  updateFormField: (index, field, val) => set(state => {
    const req = activeRequest(state);
    if (!req) return state;
    const formFields = withTrailingFormFieldRow(
      req.formFields.map((f, i) => (i === index ? { ...f, [field]: val } as FormField : f)),
      emptyFormField,
    );
    return withRequestUpdate(state, { ...req, formFields });
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
    return withRequestUpdate(state, {
      ...req,
      formFields: withTrailingFormFieldRow(formFields, emptyFormField),
    });
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
    return withRequestUpdate(state, {
      ...req,
      formFields: withTrailingFormFieldRow(formFields, emptyFormField),
    });
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
    return withRequestUpdate(state, {
      ...req,
      formFields: withTrailingFormFieldRow(formFields, emptyFormField),
    });
  }),

  removeFormField: (index) => set(state => {
    const req = activeRequest(state);
    if (!req) return state;
    const formFields = withTrailingFormFieldRow(
      req.formFields.filter((_f, i) => i !== index),
      emptyFormField,
    );
    return withRequestUpdate(state, { ...req, formFields });
  }),

  updateUrlEncodedField: (index, field, val) => set(state => {
    const req = activeRequest(state);
    if (!req) return state;
    const urlEncodedFields = withTrailingEmptyRow(
      req.urlEncodedFields.map((f, i) => (i === index ? { ...f, [field]: val } as KeyValue : f)),
      emptyKeyValue,
    );
    return withRequestUpdate(state, { ...req, urlEncodedFields });
  }),

  removeUrlEncodedField: (index) => set(state => {
    const req = activeRequest(state);
    if (!req) return state;
    const urlEncodedFields = withTrailingEmptyRow(
      req.urlEncodedFields.filter((_f, i) => i !== index),
      emptyKeyValue,
    );
    return withRequestUpdate(state, { ...req, urlEncodedFields });
  }),

  setBinaryFile: (binaryFile) => set(state => {
    const req = activeRequest(state);
    if (!req) return state;
    return withRequestUpdate(state, { ...req, binaryFile });
  }),

  applyParsedCurl: (parsed) => set(state => {
    if (!state.activeTabId) {
      const tab = newEmptyTab();
      const request = applyParsedToRequest(tab.request, parsed);
      return {
        tabs: [{ ...tab, request, unsaved: computeUnsaved(tab, request) }],
        activeTabId: tab.id,
      };
    }
    const tab = state.tabs.find((t) => t.id === state.activeTabId);
    const req = activeRequest(state);
    if (!tab || !req) return state;
    const request = applyParsedToRequest(req, parsed);
    return updateActiveTab(state, {
      request,
      unsaved: computeUnsaved(tab, request),
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

  resetRequest: () => set(state => {
    const tab = state.tabs.find((t) => t.id === state.activeTabId);
    if (!tab) return state;
    const request = { ...defaultRequest };
    return updateActiveTab(state, {
      request,
      name: 'Untitled',
      unsaved: computeUnsaved(tab, request),
    });
  }),
}));

// Selector: get the active tab
export function selectActiveTab(state: AppState): RequestTab | undefined {
  return state.tabs.find(t => t.id === state.activeTabId);
}
