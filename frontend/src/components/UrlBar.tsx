import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { useSettingsStore } from '../store/useSettings';
import { invoke } from '@tauri-apps/api/core';
import type { HttpMethod, HttpRequest, KeyValue } from '../types';
import { t } from '../i18n';
import { formatRawHttpResponse } from '../utils/httpUtils';
import {
  hasHttpProtocol,
  interpolateEnvVars,
  interpolateKeyValues,
  parseOpenEnvPlaceholder,
  resolveVariableMap,
} from '../utils/envInterpolation';
import { useEnvironmentStore } from '../store/useEnvironmentStore';
import { isCurlCommand } from '../utils/curlUtils';
import { showToast } from '../utils/toast';
import { focusUrlInput } from '../utils/focusUrl';
import { useModalOverlayDismiss } from '../utils/modalOverlayDismiss';

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

type EnvSuggestRow = { name: string; value: string };

type ParsedCurl = {
  method: string;
  url: string;
  headers: [string, string][];
  body: string | null;
};

export default function UrlBar() {
  const { setMethod, setUrl, syncParamsFromUrl, setLoading, setResponse, addHistory, applyParsedCurl } = useStore();
  const urlInputRef = useRef<HTMLInputElement>(null);
  const requestMethod = useStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.request.method ?? 'GET');
  const requestUrl = useStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.request.url ?? '');
  const loading = useStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.loading ?? false);
  const activeTabId = useStore(s => s.activeTabId);
  const [exportCurl, setExportCurl] = useState<string | null>(null);
  const exportCurlOverlayDismiss = useModalOverlayDismiss(() => setExportCurl(null));

  const envEntriesSerialized = useEnvironmentStore((s) => {
    const envId = s.activeEnvironmentId;
    const raw: Record<string, string> = {};
    for (const row of s.variables) {
      const k = row.key.trim();
      if (!k) continue;
      raw[k] = row.valuesByEnvId[envId] ?? '';
    }
    const map = resolveVariableMap(raw);
    const pairs = Object.keys(map)
      .sort((a, b) => a.localeCompare(b))
      .map((k): [string, string] => [k, map[k] ?? '']);
    return JSON.stringify(pairs);
  });

  const envVarEntries = useMemo((): EnvSuggestRow[] => {
    try {
      const parsed: unknown = JSON.parse(envEntriesSerialized);
      if (!Array.isArray(parsed)) return [];
      const out: EnvSuggestRow[] = [];
      for (const row of parsed) {
        if (Array.isArray(row) && row.length >= 2 && typeof row[0] === 'string') {
          out.push({ name: row[0], value: String(row[1] ?? '') });
        }
      }
      return out;
    } catch {
      return [];
    }
  }, [envEntriesSerialized]);

  const [envSuggest, setEnvSuggest] = useState<{ innerStart: number; innerEnd: number; list: EnvSuggestRow[] } | null>(null);
  const [envSuggestIndex, setEnvSuggestIndex] = useState(0);

  const syncEnvSuggest = useCallback((value: string, cursor: number) => {
    const open = parseOpenEnvPlaceholder(value, cursor);
    if (!open) {
      setEnvSuggest(null);
      return;
    }
    const pf = open.partialRaw.trim().toLowerCase();
    const list = envVarEntries.filter(({ name, value: varValue }) => {
      if (!pf) return true;
      // Filter by variable name and resolved value (not raw address-bar template text)
      return name.toLowerCase().includes(pf) || varValue.toLowerCase().includes(pf);
    });
    if (list.length === 0) {
      setEnvSuggest(null);
      return;
    }
    setEnvSuggest({ innerStart: open.innerStart, innerEnd: open.innerEnd, list });
    setEnvSuggestIndex(0);
  }, [envVarEntries]);

  const applyEnvSuggestion = useCallback((name: string) => {
    if (!envSuggest) return;
    const el = urlInputRef.current;
    if (!el) return;
    const { innerStart, innerEnd } = envSuggest;
    const v = el.value;
    const next = v.slice(0, innerStart) + name + '}}' + v.slice(innerEnd);
    setUrl(next);
    syncParamsFromUrl();
    setEnvSuggest(null);
    queueMicrotask(() => {
      const input = urlInputRef.current;
      if (!input) return;
      input.focus();
      const pos = innerStart + name.length + 2;
      input.setSelectionRange(pos, pos);
    });
  }, [envSuggest, setUrl, syncParamsFromUrl]);

  useEffect(() => {
    setEnvSuggest(null);
  }, [activeTabId]);

  useEffect(() => {
    const onFocusUrl = () => focusUrlInput();
    window.addEventListener('app:focus-url', onFocusUrl);
    return () => window.removeEventListener('app:focus-url', onFocusUrl);
  }, []);

  const applyCurlCommand = useCallback(async (command: string) => {
    const trimmed = command.trim();
    if (!isCurlCommand(trimmed)) return false;
    try {
      const parsed: ParsedCurl = await invoke('parse_curl', { command: trimmed });
      applyParsedCurl(parsed);
      return true;
    } catch (err) {
      showToast(`${t('url.curlParseError')}: ${err}`);
      return false;
    }
  }, [applyParsedCurl]);

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const pos = e.target.selectionStart ?? val.length;
    setUrl(val);
    syncParamsFromUrl();
    syncEnvSuggest(val, pos);
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text');
    if (!isCurlCommand(text)) return;
    e.preventDefault();
    await applyCurlCommand(text);
  };

  const handleSend = async () => {
    if (!requestUrl) return;

    const reqAfterSync = (() => {
      const s = useStore.getState();
      const tab = s.tabs.find((t) => t.id === s.activeTabId);
      return tab?.request ?? null;
    })();
    if (!reqAfterSync?.url?.trim()) return;

    const autoProtocol = useSettingsStore.getState().autoCompleteProtocol;
    if (autoProtocol && !/\{\{/.test(reqAfterSync.url)) {
      const varsForProtocol = useEnvironmentStore.getState().getActiveVarMap();
      const resolvedForProtocol = interpolateEnvVars(reqAfterSync.url, varsForProtocol);
      if (!hasHttpProtocol(resolvedForProtocol)) {
        const fixedTemplate = ensureProtocol(reqAfterSync.url);
        if (fixedTemplate !== reqAfterSync.url) setUrl(fixedTemplate);
      }
    }

    const req = (() => {
      const s = useStore.getState();
      const tab = s.tabs.find((t) => t.id === s.activeTabId);
      return tab?.request ?? null;
    })();
    if (!req?.url?.trim()) return;

    setLoading(true);

    const vars = useEnvironmentStore.getState().getActiveVarMap();
    const resolved = resolveOutboundRequest(req, vars, autoProtocol);

    try {
      const res: { status: number; status_text: string; headers: Record<string, string>; body: string; raw: string; duration_ms: number } = await invoke('send_request', {
        method: req.method,
        url: resolved.finalUrl,
        headers: kvToMap(resolved.headers),
        bodyType: resolved.effectiveBodyType,
        body: resolved.body,
      });

      setResponse({
        status: res.status,
        statusText: res.status_text,
        headers: res.headers,
        body: res.body,
        raw: res.raw,
        durationMs: res.duration_ms,
      });

      addHistory({
        method: req.method,
        url: resolved.finalUrl,
        status: res.status,
        request: resolved.historyRequest,
        response: {
          status: res.status,
          statusText: res.status_text,
          headers: res.headers,
          body: res.body,
          raw: res.raw,
          durationMs: res.duration_ms,
        },
      });
    } catch (err) {
      const errorResponse = {
        status: 0,
        statusText: 'Error',
        headers: {} as Record<string, string>,
        body: String(err),
        durationMs: 0,
      };
      setResponse({
        ...errorResponse,
        raw: formatRawHttpResponse(errorResponse),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExportCurl = async () => {
    const req = (() => {
      const s = useStore.getState();
      const tab = s.tabs.find((t) => t.id === s.activeTabId);
      return tab?.request ?? null;
    })();
    if (!req?.url?.trim()) return;

    const autoProtocol = useSettingsStore.getState().autoCompleteProtocol;
    try {
      const vars = useEnvironmentStore.getState().getActiveVarMap();
      const resolved = resolveOutboundRequest(req, vars, autoProtocol);
      const curl: string = await invoke('to_curl', {
        method: req.method,
        url: resolved.finalUrl,
        headers: kvToMap(resolved.headers),
        bodyType: resolved.effectiveBodyType,
        body: resolved.body,
      });
      setExportCurl(curl);
    } catch (err) {
      alert(`Failed to generate curl: ${err}`);
    }
  };

  return (
    <>
      <div className="url-bar">
        <select className="method-select" value={requestMethod} onChange={e => setMethod(e.target.value as HttpMethod)}>
          {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <div className="url-bar-url-field">
        <input
          ref={urlInputRef}
          className="url-input"
          type="text"
          placeholder={t('url.placeholder')}
          value={requestUrl}
          onChange={handleUrlChange}
          onPaste={handlePaste}
          onSelect={e => syncEnvSuggest(e.currentTarget.value, e.currentTarget.selectionStart ?? 0)}
          onClick={e => syncEnvSuggest(e.currentTarget.value, e.currentTarget.selectionStart ?? 0)}
          onBlur={() => {
            window.setTimeout(() => setEnvSuggest(null), 120);
          }}
          onKeyDown={async e => {
            if (envSuggest && envSuggest.list.length > 0) {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setEnvSuggestIndex(i => (i + 1) % envSuggest.list.length);
                return;
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                setEnvSuggestIndex(i => (i - 1 + envSuggest.list.length) % envSuggest.list.length);
                return;
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                setEnvSuggest(null);
                return;
              }
              if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                applyEnvSuggestion(envSuggest.list[envSuggestIndex]!.name);
                return;
              }
            }
            if (e.key === 'Enter') {
              if (isCurlCommand(requestUrl)) {
                e.preventDefault();
                await applyCurlCommand(requestUrl);
              } else {
                handleSend();
              }
            }
          }}
          aria-autocomplete="list"
          aria-expanded={!!(envSuggest && envSuggest.list.length > 0)}
          aria-controls="url-env-suggest-list"
        />
        {envSuggest && envSuggest.list.length > 0 && (
          <ul id="url-env-suggest-list" className="url-env-suggest" role="listbox">
            {envSuggest.list.map((row, idx) => (
              <li
                key={row.name}
                role="option"
                aria-selected={idx === envSuggestIndex}
                className={idx === envSuggestIndex ? 'active' : ''}
                onMouseDown={e => e.preventDefault()}
                onMouseEnter={() => setEnvSuggestIndex(idx)}
                onClick={() => applyEnvSuggestion(row.name)}
                title={row.value !== '' ? `${row.name} = ${row.value}` : row.name}
              >
                <span className="url-env-suggest-name">{row.name}</span>
                {row.value !== '' && (
                  <>
                    <span className="url-env-suggest-sep" aria-hidden>·</span>
                    <span className="url-env-suggest-value">{row.value}</span>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        </div>
        <button className="btn btn-icon" title={t('url.export.title')} onClick={handleExportCurl}>→_</button>
        <button className="btn btn-send" disabled={loading} onClick={handleSend}>{loading ? t('url.sending') : t('url.send')}</button>
      </div>

      {exportCurl !== null && (
        <div className="modal-overlay" {...exportCurlOverlayDismiss}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{t('url.export.title')}</h3>
            <div className="copy-area">{exportCurl}</div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setExportCurl(null)}>{t('url.cancel')}</button>
              <button className="btn btn-send" onClick={async () => {
                try { await navigator.clipboard.writeText(exportCurl); } catch { /* ignore */ }
                setExportCurl(null);
              }}>{t('url.copy')}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Resolve env placeholders for outbound HTTP, cURL export, and history (not for editor UI). */
function resolveOutboundRequest(
  req: HttpRequest,
  vars: Record<string, string>,
  autoProtocol: boolean,
) {
  const interpolatedUrl = interpolateEnvVars(req.url, vars);
  const params = interpolateKeyValues(req.params, vars);
  const headers = interpolateKeyValues(req.headers, vars);
  let finalUrl = interpolatedUrl;
  if (autoProtocol) finalUrl = ensureProtocol(finalUrl);

  const effectiveBodyType = req.bodyType === 'raw' ? req.rawContentType : req.bodyType;
  const templatedBody =
    (req.bodyType === 'none' || req.bodyType === 'form-data' || req.bodyType === 'x-www-form-urlencoded') && !req.body
      ? null
      : req.body;
  const body = templatedBody === null ? null : interpolateEnvVars(templatedBody, vars);

  const historyRequest: HttpRequest = {
    method: req.method,
    url: finalUrl,
    params: params.map((p) => ({ ...p })),
    headers: headers.map((h) => ({ ...h })),
    bodyType: req.bodyType,
    rawContentType: req.rawContentType,
    body: body ?? '',
  };

  return { finalUrl, headers, body, effectiveBodyType, historyRequest };
}

function kvToMap(kvs: KeyValue[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const kv of kvs) {
    if (kv.key && kv.enabled) map[kv.key] = kv.value;
  }
  return map;
}

function ensureProtocol(url: string): string {
  if (!hasHttpProtocol(url)) {
    return 'http://' + url;
  }
  return url;
}
