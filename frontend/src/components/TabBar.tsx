import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '../store/useStore';
import { useSettingsStore } from '../store/useSettings';
import { methodColors } from '../constants';
import RequestEnvToolbar from './RequestEnvToolbar';

const TAB_SCROLL_PAD = 4;

function scrollTabIntoView(tabEl: HTMLElement, container: HTMLElement) {
  const tabRect = tabEl.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  const leftInView = tabRect.left - containerRect.left;
  const rightInView = tabRect.right - containerRect.left;
  const viewWidth = containerRect.width;
  const maxVisible = viewWidth - TAB_SCROLL_PAD * 2;

  if (leftInView >= TAB_SCROLL_PAD && rightInView <= viewWidth - TAB_SCROLL_PAD) {
    return;
  }

  if (leftInView < TAB_SCROLL_PAD) {
    container.scrollLeft += leftInView - TAB_SCROLL_PAD;
    return;
  }

  // Tab wider than the scrollport (common when the folder sidebar is open):
  // align the leading edge so method + URL stay visible.
  if (tabRect.width > maxVisible) {
    container.scrollLeft += leftInView - TAB_SCROLL_PAD;
    return;
  }

  container.scrollLeft += rightInView - viewWidth + TAB_SCROLL_PAD;
}

export default function TabBar() {
  const { tabs, activeTabId, switchTab, closeTab, createTab } = useStore(
    useShallow((s) => ({
      tabs: s.tabs,
      activeTabId: s.activeTabId,
      switchTab: s.switchTab,
      closeTab: s.closeTab,
      createTab: s.createTab,
    })),
  );
  const folderSidebarOpen = useSettingsStore((s) => s.folderSidebarOpen);
  const folderSidebarWidth = useSettingsStore((s) => s.folderSidebarWidth);
  const scrollRef = useRef<HTMLDivElement>(null);
  const tabElRefs = useRef(new Map<string, HTMLDivElement>());
  const tabIdsKey = useMemo(() => tabs.map((t) => t.id).join('|'), [tabs]);

  const setTabRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) tabElRefs.current.set(id, el);
    else tabElRefs.current.delete(id);
  }, []);

  const scrollActiveTabIntoView = useCallback(() => {
    if (!activeTabId) return;
    const tabEl = tabElRefs.current.get(activeTabId);
    const container = scrollRef.current;
    if (!tabEl || !container) return;
    scrollTabIntoView(tabEl, container);
  }, [activeTabId]);

  // Scroll active tab into view when selection changes (click, shortcuts, open/close tab).
  // Manual wheel/drag scroll does not change activeTabId, so it is left alone.
  useLayoutEffect(() => {
    scrollActiveTabIntoView();
  }, [activeTabId, tabIdsKey, folderSidebarOpen, folderSidebarWidth, scrollActiveTabIntoView]);

  useLayoutEffect(() => {
    const container = scrollRef.current;
    if (!container || !activeTabId) return;

    const ro = new ResizeObserver(() => scrollActiveTabIntoView());
    ro.observe(container);
    return () => ro.disconnect();
  }, [activeTabId, scrollActiveTabIntoView]);

  if (tabs.length === 0) {
    return (
      <div className="tab-bar">
        <div className="tab-bar-tabs" ref={scrollRef}>
          <button className="tab-add" onClick={createTab} title="New Tab">+</button>
        </div>
        <RequestEnvToolbar />
      </div>
    );
  }

  return (
    <div className="tab-bar">
      <div className="tab-bar-tabs" ref={scrollRef}>
      {tabs.map(tab => {
        const isActive = tab.id === activeTabId;
        const method = tab.request.method;
        const truncated = tab.name.length > 20 ? tab.name.slice(0, 20) + '…' : tab.name;
        const isFolderTab = tab.sourceType === 'folder';
        return (
          <div
            key={tab.id}
            ref={(el) => setTabRef(tab.id, el)}
            className={`tab-item ${isActive ? 'active' : ''}${isFolderTab ? ' folder-tab' : ''}`}
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
