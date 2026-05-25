import { useCallback } from 'react';
import { useStore } from '../store/useStore';
import { t } from '../i18n';
import { highlightJson, isJson, formatJson } from '../utils/jsonUtils';
import { getRawHttpResponse, getResponseCopyText } from '../utils/httpUtils';
import { showToast } from '../utils/toast';

export default function ResponsePanel() {
  const responseTab = useStore((s) => s.responseTab);
  const setResponseTab = useStore((s) => s.setResponseTab);
  const tab = useStore((s) => s.tabs.find((t) => t.id === s.activeTabId));
  const response = tab?.response ?? null;
  const loading = tab?.loading ?? false;

  const handleCopy = useCallback(async () => {
    if (!response) return;
    const text = getResponseCopyText(response, responseTab);
    if (!text) {
      showToast(t('response.copyEmpty'));
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      showToast(t('response.copied'));
    } catch {
      showToast(t('response.copyFailed'));
    }
  }, [response, responseTab]);

  if (!response && !loading) {
    return (
      <div className="response-panel">
        <div className="response-placeholder">{t('app.response.placeholder')}</div>
      </div>
    );
  }

  const statusClass = response && (response.status >= 200 && response.status < 300 ? 'status-2xx'
    : response.status >= 300 && response.status < 400 ? 'status-3xx'
    : response.status >= 400 && response.status < 500 ? 'status-4xx'
    : 'status-5xx');

  const jsonValid = response ? isJson(response.body) : false;
  const formattedBody = response && responseTab === 'body'
    ? (jsonValid ? formatJson(response.body).formatted : response.body)
    : '';
  const rawHttp = response ? getRawHttpResponse(response) : '';

  return (
    <div className="response-panel">
      <div className="response-header">
        <div className="response-tabs">
          <span className={`response-tab ${responseTab === 'body' ? 'active' : ''}`} onClick={() => setResponseTab('body')}>{t('response.body')}</span>
          <span className={`response-tab ${responseTab === 'headers' ? 'active' : ''}`} onClick={() => setResponseTab('headers')}>{t('response.headers')}</span>
          <span className={`response-tab ${responseTab === 'raw' ? 'active' : ''}`} onClick={() => setResponseTab('raw')}>{t('response.raw')}</span>
        </div>
        <div className="response-header-meta">
          {response ? (
            <>
              <span className={`status-badge ${statusClass}`}>{response.status} {response.statusText}</span>
              <span className="response-time">{response.durationMs}ms</span>
              {responseTab === 'body' && jsonValid && (
                <span className="json-status valid" style={{ fontSize: 11 }}>JSON</span>
              )}
              <button
                type="button"
                className="btn btn-secondary response-copy-btn"
                onClick={() => void handleCopy()}
              >
                {t('response.copy')}
              </button>
            </>
          ) : null}
        </div>
      </div>
      <div className="response-body">
        {response ? (
          responseTab === 'body' ? (
            jsonValid ? (
              <div
                className="json-highlight"
                dangerouslySetInnerHTML={{ __html: highlightJson(formattedBody) }}
              />
            ) : (
              <pre>{formattedBody}</pre>
            )
          ) : responseTab === 'headers' ? (
            <div className="kv-table-wrap">
            <table className="kv-table">
              <thead><tr><th>{t('kv.key')}</th><th>{t('kv.value')}</th></tr></thead>
              <tbody>
                {Object.entries(response.headers).map(([k, v]) => (
                  <tr key={k}><td>{k}</td><td>{v}</td></tr>
                ))}
              </tbody>
            </table>
            </div>
          ) : (
            <pre className="response-raw">{rawHttp}</pre>
          )
        ) : null}
      </div>
      {loading && (
        <div className="response-loading-overlay" aria-busy="true">
          <span className="response-spinner" aria-hidden />
        </div>
      )}
    </div>
  );
}
