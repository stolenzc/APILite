import { useStore } from '../store/useStore';
import { t } from '../i18n';

const METHOD_COLORS: Record<string, string> = {
  GET: 'var(--get)',
  POST: 'var(--post)',
  PUT: 'var(--put)',
  DELETE: 'var(--delete)',
  PATCH: 'var(--patch)',
  HEAD: 'var(--head)',
  OPTIONS: 'var(--options)',
};

export default function HistoryPanel() {
  const { history, clearHistory, loadFromHistory } = useStore();

  if (history.length === 0) return null;

  return (
    <div className="history-panel">
      <div className="history-header">
        <span>{t('history.label')} ({history.length})</span>
        <button className="btn btn-icon" style={{ fontSize: 12 }} onClick={clearHistory} title={t('history.clear')}>{t('history.clear')}</button>
      </div>
      <ul className="history-list">
        {history.map(entry => (
          <li key={entry.id} className="history-item" onClick={() => loadFromHistory(entry)}>
            <span className="history-time">{entry.time}</span>
            <span className="history-method" style={{ color: METHOD_COLORS[entry.method] || 'var(--text-primary)' }}>{entry.method}</span>
            <span className="history-url">{entry.url}</span>
            <span className={`history-status ${entry.status >= 400 ? 'status-5xx' : 'status-2xx'}`}>{entry.status || '-'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
