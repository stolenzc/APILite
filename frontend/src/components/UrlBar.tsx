import { useCallback, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { useSettingsStore } from '../store/useSettings';
import { invoke } from '@tauri-apps/api/core';
import type { HttpMethod } from '../types';
import { t } from '../i18n';
import { formatRawHttpResponse } from '../utils/httpUtils';
import { hasHttpProtocol, interpolateEnvVars } from '../utils/envInterpolation';
import { useEnvironmentStore } from '../store/useEnvironmentStore';
import { isCurlCommand } from '../utils/curlUtils';
import { showToast } from '../utils/toast';
import { focusUrlInput } from '../utils/focusUrl';
import { EnvVarField } from './EnvVarField';
import { kvToMap, resolveOutboundRequest } from '../utils/outboundRequest';

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
        formFields: resolved.formFields,
        binaryFilePath: resolved.binaryFile?.filePath ?? null,
        binaryFileName: resolved.binaryFile?.fileName ?? null,
        binaryDataBase64: resolved.binaryFile?.fileDataBase64 ?? null,
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

  return (
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
      <button className="btn btn-send" disabled={loading} onClick={handleSend}>
        {loading ? t('url.sending') : t('url.send')}
      </button>
    </div>
  );
}

function ensureProtocol(url: string): string {
  if (!hasHttpProtocol(url)) {
    return 'http://' + url;
  }
  return url;
}
