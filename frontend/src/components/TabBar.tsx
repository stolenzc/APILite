import { useStore } from '../store/useStore';
import { methodColors } from '../constants';

export default function TabBar() {
  const { tabs, activeTabId, switchTab, closeTab, createTab } = useStore();

  if (tabs.length === 0) {
    return (
      <div className="tab-bar">
        <button className="tab-add" onClick={createTab} title="New Tab">+</button>
      </div>
    );
  }

  return (
    <div className="tab-bar">
      {tabs.map(tab => {
        const isActive = tab.id === activeTabId;
        const method = tab.request.method;
        const truncated = tab.name.length > 20 ? tab.name.slice(0, 20) + '…' : tab.name;
        const isHistory = tab.sourceType === 'history';
        const isCollection = tab.sourceType === 'collection';
        return (
          <div
            key={tab.id}
            className={`tab-item ${isActive ? 'active' : ''} ${isHistory ? 'history' : ''} ${isCollection ? 'collection' : ''}`}
            onClick={() => switchTab(tab.id)}
          >
            <span className="tab-method" style={{ color: (methodColors as any)[method] }}>
              {method}
            </span>
            <span className="tab-url">{truncated}</span>
            {tab.unsaved && <span className="tab-unsaved" title="Unsaved" />}
            <button className="tab-close" onClick={e => { e.stopPropagation(); closeTab(tab.id); }}>
              ×
            </button>
          </div>
        );
      })}
      <button className="tab-add" onClick={createTab} title="New Tab">+</button>
    </div>
  );
}
