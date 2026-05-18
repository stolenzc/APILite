import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { useSettingsStore } from '../store/useSettings';
import { invoke } from '@tauri-apps/api/core';
import type { HttpMethod, KeyValue } from '../types';
import { t } from '../i18n';
import { formatRawHttpResponse } from '../utils/httpUtils';
import { interpolateEnvVars, interpolateKeyValues, parseOpenEnvPlaceholder, resolveVariableMap } from '../utils/envInterpolation';
import { useEnvironmentStore } from '../store/useEnvironmentStore';
import { isCurlCommand } from '../utils/curlUtils';
import { showToast } from '../utils/toast';

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

type EnvSuggestRow = { name: string; value: string };

type ParsedCurl = {
  method: string;
  url: string;
  headers: [string, string][];
  body: string | null;
};

export default function UrlBar() {
  const { setMethod, setUrl, syncParamsFromUrl, syncUrlFromParams, setLoading, setResponse, addHistory, applyParsedCurl } = useStore();
  const urlInputRef = useRef<HTMLInputElement>(null);
  const requestMethod = useStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.request.method ?? 'GET');
  const requestUrl = useStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.request.url ?? '');
  const requestParams = useStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.request.params ?? []);
  const requestHeaders = useStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.request.headers ?? []);
  const requestBodyType = useStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.request.bodyType ?? 'none');
  const rawContentType = useStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.request.rawContentType ?? 'json');
  const requestBody = useStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.request.body ?? '');
  const loading = useStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.loading ?? false);
  const activeTabId = useStore(s => s.activeTabId);
  const [exportCurl, setExportCurl] = useState<string | null>(null);

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
    const list = envVarEntries.filter(({ name, value }) => {
      if (!pf) return true;
      return name.toLowerCase().includes(pf) || value.toLowerCase().includes(pf);
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

    syncUrlFromParams();
    setLoading(true);

    const vars = useEnvironmentStore.getState().getActiveVarMap();
    const interpolatedUrl = interpolateEnvVars(requestUrl, vars);
    const interpolatedParams = interpolateKeyValues(requestParams, vars);
    const interpolatedHeaders = interpolateKeyValues(requestHeaders, vars);

    const autoProtocol = useSettingsStore.getState().autoCompleteProtocol;
    let finalUrl = urlWithParams(interpolatedUrl, interpolatedParams);
    if (autoProtocol) {
      finalUrl = ensureProtocol(finalUrl);
      if (finalUrl !== requestUrl) setUrl(finalUrl);
    }

    try {
      const effectiveBodyType = requestBodyType === 'raw' ? rawContentType : requestBodyType;
      const templatedBody =
        (requestBodyType === 'none' || requestBodyType === 'form-data' || requestBodyType === 'x-www-form-urlencoded') && !requestBody
          ? null
          : requestBody;
      const bodyContent = templatedBody === null ? null : interpolateEnvVars(templatedBody, vars);

      const res: { status: number; status_text: string; headers: Record<string, string>; body: string; raw: string; duration_ms: number } = await invoke('send_request', {
        method: requestMethod,
        url: finalUrl,
        headers: kvToMap(interpolatedHeaders),
        bodyType: effectiveBodyType,
        body: bodyContent,
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
        method: requestMethod,
        url: finalUrl,
        status: res.status,
        request: {
          method: requestMethod,
          url: finalUrl,
          params: requestParams.map(p => ({ ...p })),
          headers: requestHeaders.map(h => ({ ...h })),
          bodyType: requestBodyType,
          rawContentType,
          body: requestBody,
        },
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
    syncUrlFromParams();
    const autoProtocol = useSettingsStore.getState().autoCompleteProtocol;
    try {
      const effectiveBodyType = requestBodyType === 'raw' ? rawContentType : requestBodyType;
      const vars = useEnvironmentStore.getState().getActiveVarMap();
      let url = urlWithParams(interpolateEnvVars(requestUrl, vars), interpolateKeyValues(requestParams, vars));
      if (autoProtocol) url = ensureProtocol(url);
      const templatedBody =
        requestBodyType === 'none' ? null : requestBody;
      const bodyForCurl = templatedBody === null ? null : interpolateEnvVars(templatedBody, vars);
      const curl: string = await invoke('to_curl', {
        method: requestMethod,
        url,
        headers: kvToMap(interpolateKeyValues(requestHeaders, vars)),
        bodyType: effectiveBodyType,
        body: bodyForCurl,
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
        <div className="modal-overlay" onClick={() => setExportCurl(null)}>
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

function kvToMap(kvs: KeyValue[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const kv of kvs) {
    if (kv.key && kv.enabled) map[kv.key] = kv.value;
  }
  return map;
}

function urlWithParams(url: string, params: KeyValue[]): string {
  const baseUrl = url.split('?')[0];
  const active = params.filter(p => p.key && p.enabled);
  if (active.length === 0) return baseUrl;
  const qs = active.map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&');
  return `${baseUrl}?${qs}`;
}

function ensureProtocol(url: string): string {
  if (!/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(url)) {
    return 'http://' + url;
  }
  return url;
}
