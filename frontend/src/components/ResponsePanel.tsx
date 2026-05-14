import { useStore } from '../store/useStore';
import { t } from '../i18n';
import { highlightJson, isJson, formatJson } from '../utils/jsonUtils';

export default function ResponsePanel() {
  const responseTab = useStore((s) => s.responseTab);
  const setResponseTab = useStore((s) => s.setResponseTab);
  const response = useStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.response ?? null);

  if (!response) {
    return (
      <div className="response-panel">
        <div className="response-placeholder">{t('app.response.placeholder')}</div>
      </div>
    );
  }

  const statusClass = response.status >= 200 && response.status < 300 ? 'status-2xx'
    : response.status >= 300 && response.status < 400 ? 'status-3xx'
    : response.status >= 400 && response.status < 500 ? 'status-4xx'
    : 'status-5xx';

  const jsonValid = isJson(response.body);
  const formattedBody = responseTab === 'body'
    ? (jsonValid ? formatJson(response.body).formatted : response.body)
    : '';

  return (
    <div className="response-panel">
      <div className="response-header">
        <span className={`status-badge ${statusClass}`}>{response.status} {response.statusText}</span>
        <span className="response-time">{response.durationMs}ms</span>
        {responseTab === 'body' && jsonValid && (
          <span className="json-status valid" style={{ fontSize: 11 }}>JSON</span>
        )}
        <div className="response-tabs">
          <span className={`response-tab ${responseTab === 'body' ? 'active' : ''}`} onClick={() => setResponseTab('body')}>{t('response.body')}</span>
          <span className={`response-tab ${responseTab === 'headers' ? 'active' : ''}`} onClick={() => setResponseTab('headers')}>{t('response.headers')}</span>
        </div>
      </div>
      <div className="response-body">
        {responseTab === 'body' ? (
          jsonValid ? (
            <div
              className="json-highlight"
              dangerouslySetInnerHTML={{ __html: highlightJson(formattedBody) }}
            />
          ) : (
            <pre>{formattedBody}</pre>
          )
        ) : (
          <table className="kv-table">
            <thead><tr><th>{t('kv.key')}</th><th>{t('kv.value')}</th></tr></thead>
            <tbody>
              {Object.entries(response.headers).map(([k, v]) => (
                <tr key={k}><td>{k}</td><td>{v}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
