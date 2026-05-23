import { useStore } from '../store/useStore';
import { methodColors } from '../constants';
import RequestEnvToolbar from './RequestEnvToolbar';

export default function TabBar() {
  const { tabs, activeTabId, switchTab, closeTab, createTab } = useStore();

  if (tabs.length === 0) {
    return (
      <div className="tab-bar">
        <div className="tab-bar-tabs">
          <button className="tab-add" onClick={createTab} title="New Tab">+</button>
        </div>
        <RequestEnvToolbar />
      </div>
    );
  }

  return (
    <div className="tab-bar">
      <div className="tab-bar-tabs">
      {tabs.map(tab => {
        const isActive = tab.id === activeTabId;
        const method = tab.request.method;
        const truncated = tab.name.length > 20 ? tab.name.slice(0, 20) + '…' : tab.name;
        const isCollection = tab.sourceType === 'collection';
        return (
          <div
            key={tab.id}
            className={`tab-item ${isActive ? 'active' : ''}${isCollection ? ' collection' : ''}`}
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
      <RequestEnvToolbar />
    </div>
  );
}
