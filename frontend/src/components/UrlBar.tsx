import { useState, useCallback, useEffect } from 'react';
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
} from '../utils/envInterpolation';
import { useEnvironmentStore } from '../store/useEnvironmentStore';
import { isCurlCommand } from '../utils/curlUtils';
import { showToast } from '../utils/toast';
import { focusUrlInput } from '../utils/focusUrl';
import { useModalOverlayDismiss } from '../utils/modalOverlayDismiss';
import { EnvVarField } from './EnvVarField';

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

type ParsedCurl = {
  method: string;
  url: string;
  headers: [string, string][];
  body: string | null;
};

export default function UrlBar() {
  const { setMethod, setUrl, syncParamsFromUrl, setLoading, setResponse, addHistory, applyParsedCurl } = useStore();
  const requestMethod = useStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.request.method ?? 'GET');
  const requestUrl = useStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.request.url ?? '');
  const loading = useStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.loading ?? false);
  const [exportCurl, setExportCurl] = useState<string | null>(null);
  const exportCurlOverlayDismiss = useModalOverlayDismiss(() => setExportCurl(null));

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
      const res: {
        status: number;
        status_text: string;
        headers: Record<string, string>;
        body: string;
        request_raw: string;
        raw: string;
        duration_ms: number;
      } = await invoke('send_request', {
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
        requestRaw: res.request_raw,
        responseRaw: res.raw,
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
        <EnvVarField
          className="url-input"
          type="text"
          placeholder={t('url.placeholder')}
          value={requestUrl}
          onValueChange={(val) => {
            setUrl(val);
            syncParamsFromUrl();
          }}
          onPaste={handlePaste}
          onKeyDown={async (e) => {
            if (e.key === 'Enter') {
              if (isCurlCommand(requestUrl)) {
                e.preventDefault();
                await applyCurlCommand(requestUrl);
              } else {
                handleSend();
              }
            }
          }}
          suggestListId="url-env-suggest-list"
        />
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

/** Resolve env placeholders for outbound HTTP and cURL export (not for editor UI). */
function resolveOutboundRequest(
  req: HttpRequest,
  vars: Record<string, string>,
  autoProtocol: boolean,
) {
  const interpolatedUrl = interpolateEnvVars(req.url, vars);
  const headers = interpolateKeyValues(req.headers, vars);
  let finalUrl = interpolatedUrl;
  if (autoProtocol) finalUrl = ensureProtocol(finalUrl);

  const effectiveBodyType = req.bodyType === 'raw' ? req.rawContentType : req.bodyType;
  const templatedBody =
    (req.bodyType === 'none' || req.bodyType === 'form-data' || req.bodyType === 'x-www-form-urlencoded') && !req.body
      ? null
      : req.body;
  const body = templatedBody === null ? null : interpolateEnvVars(templatedBody, vars);

  return { finalUrl, headers, body, effectiveBodyType };
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
