import { create } from 'zustand';
import { nanoid } from 'nanoid';
import type { HttpRequest, HttpResponse, HistoryEntry, KeyValue } from '../types';

const defaultParams: KeyValue[] = [];
const defaultHeaders: KeyValue[] = [];

const defaultRequest: HttpRequest = {
  method: 'GET',
  url: '',
  params: [...defaultParams],
  headers: [...defaultHeaders],
  bodyType: 'none',
  body: '',
};

interface AppState {
  request: HttpRequest;
  response: HttpResponse | null;
  loading: boolean;
  history: HistoryEntry[];
  activeTab: 'params' | 'headers' | 'body';
  responseTab: 'body' | 'headers';

  // Request actions
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

export const useStore = create<AppState>((set, get) => ({
  request: { ...defaultRequest },
  response: null,
  loading: false,
  history: [],
  activeTab: 'params',
  responseTab: 'body',

  setMethod: (method) => set(state => ({ request: { ...state.request, method } })),

  setUrl: (url) => set(state => {
    const params = parseParamsFromUrl(url);
    return {
      request: {
        ...state.request,
        url,
        params: params.length > 0 ? params : state.request.params,
      },
    };
  }),

  syncParamsFromUrl: () => set(state => {
    const params = parseParamsFromUrl(state.request.url);
    return { request: { ...state.request, params } };
  }),

  syncUrlFromParams: () => set(state => ({
    request: { ...state.request, url: urlWithParams(state.request.url, state.request.params) },
  })),

  updateParam: (index, field, val) => set(state => {
    const params = [...state.request.params];
    params[index] = { ...params[index], [field]: val };
    return { request: { ...state.request, params } };
  }),

  addParam: () => set(state => ({
    request: { ...state.request, params: [...state.request.params, { key: '', value: '', enabled: true }] },
  })),

  removeParam: (index) => set(state => {
    const params = state.request.params.filter((_p: KeyValue, i: number) => i !== index);
    return { request: { ...state.request, params } };
  }),

  updateHeader: (index, field, val) => set(state => {
    const headers = [...state.request.headers];
    headers[index] = { ...headers[index], [field]: val };
    return { request: { ...state.request, headers } };
  }),

  addHeader: () => set(state => ({
    request: { ...state.request, headers: [...state.request.headers, { key: '', value: '', enabled: true }] },
  })),

  removeHeader: (index) => set(state => {
    const headers = state.request.headers.filter((_h: KeyValue, i: number) => i !== index);
    return { request: { ...state.request, headers } };
  }),

  setBodyType: (bodyType) => set(state => ({ request: { ...state.request, bodyType } })),
  setBody: (body) => set(state => ({ request: { ...state.request, body } })),
  setActiveTab: (activeTab) => set({ activeTab }),
  setResponseTab: (responseTab) => set({ responseTab }),

  setResponse: (response) => set({ response }),
  setLoading: (loading) => set({ loading }),

  addHistory: (entry) => set(state => ({
    history: [{ ...entry, id: nanoid(), time: new Date().toLocaleTimeString() }, ...state.history].slice(0, 50),
  })),

  clearHistory: () => set({ history: [] }),

  loadFromHistory: (entry) => set(state => ({
    request: { ...entry.request },
    response: state.response,
  })),

  resetRequest: () => set({ request: { ...defaultRequest } }),
}));
