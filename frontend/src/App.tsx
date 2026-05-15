import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useStore } from './store/useStore';
import { useSettingsStore, initKeyboardShortcuts } from './store/useSettings';
import { useCollectionStore } from './store/useCollection';
import { applyTheme } from './themes';
import { setLocale, getLocale } from './i18n';
import UrlBar from './components/UrlBar';
import ParamsTab from './components/ParamsTab';
import HeadersTab from './components/HeadersTab';
import BodyEditor from './components/BodyEditor';
import ResponsePanel from './components/ResponsePanel';
import HistoryPanel from './components/HistoryPanel';
import SettingsPanel from './components/SettingsPanel';
import ResizableSplitter from './components/ResizableSplitter';
import CollectionSidebar from './components/CollectionSidebar';
import TabBar from './components/TabBar';
import SaveRequestModal from './components/SaveRequestModal';

export default function App() {
  const { activeTab, setActiveTab, createTab, closeTab, tabs, activeTabId } = useStore();
  const { theme, locale, settingsOpen, setSettingsOpen, responseHeight, collectionDir, setCollectionDir } = useSettingsStore();
  const initCollections = useCollectionStore(s => s.initCollections);

  // Load collections from file system on startup and when dir changes
  useEffect(() => {
    if (collectionDir) {
      initCollections(collectionDir);
    } else {
      // Resolve and set default collection directory
      invoke<string>('get_default_collection_dir').then(dir => {
        setCollectionDir(dir);
      }).catch(err => {
        console.error('Failed to get default collection dir:', err);
      });
    }
  }, [collectionDir, initCollections, setCollectionDir]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [toast, setToast] = useState('');
  const [saveModalOpen, setSaveModalOpen] = useState(false);

  // Close save modal on Escape
  useEffect(() => {
    if (!saveModalOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSaveModalOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [saveModalOpen]);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSaveRequest = (folderId: string | null, name: string) => {
    const activeTab = useStore.getState().tabs.find(t => t.id === useStore.getState().activeTabId);
    if (!activeTab) return;
    const req = activeTab.request;
    useCollectionStore.getState().addRequest(folderId, name, {
      method: req.method,
      url: req.url,
      params: req.params.map(p => ({ ...p })),
      headers: req.headers.map(h => ({ ...h })),
      bodyType: req.bodyType,
      rawContentType: req.rawContentType,
      body: req.body,
    });
    useStore.getState().clearUnsaved();
    setSaveModalOpen(false);
    setToast('Saved!');
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 1500);
  };

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    setLocale(locale);
  }, [locale]);

  const createTabRef = useRef(createTab);
  const closeTabRef = useRef(closeTab);
  const tabsRef = useRef(tabs);
  const activeTabIdRef = useRef(activeTabId);

  useEffect(() => {
    createTabRef.current = createTab;
    closeTabRef.current = closeTab;
    tabsRef.current = tabs;
    activeTabIdRef.current = activeTabId;
  }, [createTab, closeTab, tabs, activeTabId]);

  useEffect(() => {
    initKeyboardShortcuts();

    // JS keyboard shortcuts (works in browser dev mode)
    window.addEventListener('shortcut:new-tab', () => createTabRef.current());
    window.addEventListener('shortcut:save-request', () => {
      const activeTab = useStore.getState().tabs.find(t => t.id === useStore.getState().activeTabId);
      if (activeTab?.collectionId) {
        const req = activeTab.request;
        useCollectionStore.getState().updateRequest(activeTab.collectionId, activeTab.name, {
          method: req.method,
          url: req.url,
          params: req.params.map(p => ({ ...p })),
          headers: req.headers.map(h => ({ ...h })),
          bodyType: req.bodyType,
          rawContentType: req.rawContentType,
          body: req.body,
        });
        useStore.getState().clearUnsaved();
        setToast('Saved!');
        if (toastTimer.current) clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToast(''), 1500);
      } else {
        setSaveModalOpen(true);
      }
    });
    window.addEventListener('shortcut:close-tab', () => {
      if (activeTabIdRef.current && tabsRef.current.length > 1) {
        closeTabRef.current(activeTabIdRef.current);
      } else {
        invoke('force_close_window');
      }
    });

    // Native window close (close button, etc.)
    listen('native-close-requested', () => {
      if (tabsRef.current.length > 1) {
        closeTabRef.current(activeTabIdRef.current!);
      } else {
        invoke('force_close_window');
      }
    });

    // Global shortcut events from Tauri (Cmd+T, Cmd+W)
    listen('menu:tab-new', () => {
      setToast('New Tab');
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(''), 800);
      createTabRef.current();
    });
    listen('menu:tab-close', () => {
      setToast('Close Tab');
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(''), 800);
      if (tabsRef.current.length > 1) {
        closeTabRef.current(activeTabIdRef.current!);
      } else {
        invoke('force_close_window');
      }
    });
  }, []);

  return (
    <>
      <div className="app-header">
        <img src="/logo.png" alt="APILite" style={{ height: 28, borderRadius: 6 }} />
        <button className="btn btn-icon" onClick={() => setSidebarOpen(!sidebarOpen)} title="Toggle Collections">☰</button>
        <button className="btn btn-icon" onClick={() => setSettingsOpen(!settingsOpen)} title="Settings (Ctrl+,)">⚙</button>
      </div>
      <TabBar />
      <div className="main-content">
        {sidebarOpen && <CollectionSidebar />}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
            <UrlBar />
            <div className="tabs">
              <span className={`tab ${activeTab === 'params' ? 'active' : ''}`} onClick={() => setActiveTab('params')}>Params</span>
              <span className={`tab ${activeTab === 'headers' ? 'active' : ''}`} onClick={() => setActiveTab('headers')}>Headers</span>
              <span className={`tab ${activeTab === 'body' ? 'active' : ''}`} onClick={() => setActiveTab('body')}>Body</span>
            </div>
            <div style={{ flex: 1, borderBottom: '1px solid var(--border-color)', overflow: 'auto', minHeight: 0 }}>
              {activeTab === 'params' && <ParamsTab />}
              {activeTab === 'headers' && <HeadersTab />}
              {activeTab === 'body' && <BodyEditor />}
            </div>
          </div>
          <ResizableSplitter />
          <div style={{ height: responseHeight, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <ResponsePanel />
            <HistoryPanel />
          </div>
        </div>
      </div>
      <SettingsPanel />
      {saveModalOpen && (
        <SaveRequestModal
          onClose={() => setSaveModalOpen(false)}
          onSave={handleSaveRequest}
          defaultName={tabs.find(t => t.id === activeTabId)?.name ?? 'New Request'}
        />
      )}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--accent)',
          color: 'white',
          padding: '8px 20px',
          borderRadius: 6,
          fontSize: 13,
          fontWeight: 600,
          zIndex: 9999,
          pointerEvents: 'none',
        }}>
          {toast}
        </div>
      )}
    </>
  );
}
