import { useStore } from '../store/useStore';
import { methodColors } from '../constants';

export default function TabBar() {
  const { tabs, activeTabId, switchTab, closeTab, createTab } = useStore();

  if (tabs.length === 0) return null;

  return (
    <div className="tab-bar">
      {tabs.map(tab => {
        const isActive = tab.id === activeTabId;
        const method = tab.request.method;
        const url = tab.request.url || 'untitled';
        const truncated = url.length > 24 ? url.slice(0, 24) + '…' : url;
        return (
          <div
            key={tab.id}
            className={`tab-item ${isActive ? 'active' : ''}`}
            onClick={() => switchTab(tab.id)}
          >
            <span className="tab-method" style={{ color: (methodColors as any)[method] }}>
              {method}
            </span>
            <span className="tab-url">{truncated}</span>
            {tabs.length > 1 && (
              <button className="tab-close" onClick={e => { e.stopPropagation(); closeTab(tab.id); }}>
                ×
              </button>
            )}
          </div>
        );
      })}
      <button className="tab-add" onClick={createTab} title="New Tab">+</button>
    </div>
  );
}
