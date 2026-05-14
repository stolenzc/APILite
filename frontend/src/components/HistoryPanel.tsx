import { useRef, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { useSettingsStore } from '../store/useSettings';
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
  const { historyCollapsed, setHistoryCollapsed, historyHeight, setHistoryHeight } = useSettingsStore();
  const panelRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = panelRef.current?.getBoundingClientRect().height ?? 300;

    const onMouseMove = (ev: MouseEvent) => {
      const delta = startY - ev.clientY;
      const newHeight = Math.max(100, Math.min(600, startHeight + delta));
      setHistoryHeight(newHeight);
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [setHistoryHeight]);

  return (
    <div
      ref={panelRef}
      className="history-panel"
      style={{
        height: historyCollapsed ? 32 : historyHeight,
        borderBottom: historyCollapsed ? '1px solid var(--border-color)' : 'none',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {/* Drag handle - only visible when expanded */}
      {!historyCollapsed && (
        <div className="history-drag-handle" onMouseDown={handleMouseDown} />
      )}
      <div
        className="history-header"
        onClick={() => setHistoryCollapsed(!historyCollapsed)}
        style={{ cursor: 'pointer' }}
      >
        <span>
          {historyCollapsed ? '▶' : '▼'} {t('history.label')} ({history.length})
        </span>
        {!historyCollapsed && (
          <button className="btn btn-icon" style={{ fontSize: 12 }} onClick={e => { e.stopPropagation(); clearHistory(); }} title={t('history.clear')}>{t('history.clear')}</button>
        )}
      </div>
      {!historyCollapsed && (
        <ul className="history-list" style={{ overflowY: 'auto', height: 'calc(100% - 24px)' }}>
          {history.map(entry => (
            <li key={entry.id} className="history-item" onClick={() => loadFromHistory(entry)}>
              <span className="history-time">{entry.time}</span>
              <span className="history-method" style={{ color: METHOD_COLORS[entry.method] || 'var(--text-primary)' }}>{entry.method}</span>
              <span className="history-url">{entry.url}</span>
              <span className={`history-status ${entry.status >= 400 ? 'status-5xx' : 'status-2xx'}`}>{entry.status || '-'}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
