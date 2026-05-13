import { useState } from 'react';
import { useStore } from '../store/useStore';
import { invoke } from '@tauri-apps/api/core';
import type { HttpMethod, KeyValue } from '../types';
import { t } from '../i18n';

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

export default function UrlBar() {
  const { request, setMethod, setUrl, syncParamsFromUrl, syncUrlFromParams, updateParam, loading, setLoading, setResponse, addHistory, setBodyType, setBody } = useStore();
  const [curlModal, setCurlModal] = useState<{ type: 'export' | 'import'; content: string } | null>(null);

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(e.target.value);
    syncParamsFromUrl();
  };

  const handleSend = async () => {
    if (!request.url) return;

    syncUrlFromParams();
    setLoading(true);

    try {
      const finalUrl = urlWithParams(request.url, request.params);
      const bodyContent = (request.bodyType === 'none' || request.bodyType === 'form-data' || request.bodyType === 'x-www-form-urlencoded') && !request.body ? null : request.body;

      const res: { status: number; status_text: string; headers: Record<string, string>; body: string; duration_ms: number } = await invoke('send_request', {
        method: request.method,
        url: finalUrl,
        headers: kvToMap(request.headers),
        bodyType: request.bodyType,
        body: bodyContent,
      });

      setResponse({
        status: res.status,
        statusText: res.status_text,
        headers: res.headers,
        body: res.body,
        durationMs: res.duration_ms,
      });

      addHistory({
        method: request.method,
        url: finalUrl,
        status: res.status,
        request: { ...request, url: finalUrl },
      });
    } catch (err) {
      setResponse({
        status: 0,
        statusText: 'Error',
        headers: {},
        body: String(err),
        durationMs: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleImportCurl = async () => {
    setCurlModal({ type: 'import', content: '' });
  };

  const handleImportSubmit = async () => {
    if (!curlModal || curlModal.content.trim() === '') return;
    try {
      const parsed: { method: string; url: string; headers: [string, string][]; body: string | null } = await invoke('parse_curl', { command: curlModal.content });
      setMethod(parsed.method.toUpperCase() as HttpMethod);
      setUrl(parsed.url);
      setTimeout(() => syncParamsFromUrl(), 0);
      if (parsed.body) {
        setBodyType(parsed.body.startsWith('{') ? 'json' : parsed.body.startsWith('<?xml') ? 'xml' : 'raw');
        setBody(parsed.body);
      }
      setCurlModal(null);
    } catch (err) {
      alert(`Failed to parse curl: ${err}`);
    }
  };

  const handleExportCurl = async () => {
    syncUrlFromParams();
    try {
      const curl: string = await invoke('to_curl', {
        method: request.method,
        url: urlWithParams(request.url, request.params),
        headers: kvToMap(request.headers),
        bodyType: request.bodyType,
        body: request.bodyType === 'none' ? null : request.body,
      });
      setCurlModal({ type: 'export', content: curl });
    } catch (err) {
      alert(`Failed to generate curl: ${err}`);
    }
  };

  return (
    <>
      <div className="url-bar">
        <select className="method-select" value={request.method} onChange={e => setMethod(e.target.value as HttpMethod)}>
          {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <input className="url-input" type="text" placeholder={t('url.placeholder')} value={request.url} onChange={handleUrlChange} onKeyDown={e => {
          if (e.key === 'Enter') {
            if (request.url.startsWith('curl')) {
              handleImportCurl();
            } else {
              handleSend();
            }
          }
        }} />
        <button className="btn btn-icon" title={t('url.import.title')} onClick={handleImportCurl}>{'{}'}</button>
        <button className="btn btn-icon" title={t('url.export.title')} onClick={handleExportCurl}>→_</button>
        <button className="btn btn-send" disabled={loading} onClick={handleSend}>{loading ? t('url.sending') : t('url.send')}</button>
      </div>

      {curlModal && (
        <div className="modal-overlay" onClick={() => setCurlModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{curlModal.type === 'import' ? t('url.import.title') : t('url.export.title')}</h3>
            {curlModal.type === 'import' ? (
              <textarea
                value={curlModal.content}
                onChange={e => setCurlModal({ ...curlModal, content: e.target.value })}
                placeholder={t('url.import.placeholder')}
                spellCheck={false}
              />
            ) : (
              <div className="copy-area">{curlModal.content}</div>
            )}
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setCurlModal(null)}>{t('url.cancel')}</button>
              {curlModal.type === 'export' ? (
                <button className="btn btn-send" onClick={async () => {
                  try { await navigator.clipboard.writeText(curlModal.content); } catch { /* ignore */ }
                  setCurlModal(null);
                }}>{t('url.copy')}</button>
              ) : (
                <button className="btn btn-send" onClick={handleImportSubmit}>{t('url.importBtn')}</button>
              )}
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
