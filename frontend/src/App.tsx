import { useState, useEffect, useRef } from 'react';
import { nanoid } from 'nanoid';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from './store/useStore';
import { useSettingsStore, initKeyboardShortcuts } from './store/useSettings';
import { initTextNavigationKeys } from './utils/textNavigationKeys';
import { useFolderStore, getFolderPath } from './store/useFolderStore';
import { applyTheme } from './themes';
import { setLocale, t } from './i18n';
import UrlBar from './components/UrlBar';
import TitleBar from './components/TitleBar';
import ParamsTab from './components/ParamsTab';
import HeadersTab from './components/HeadersTab';
import EnvironmentModal from './components/EnvironmentModal';
import ScriptManagerModal from './components/ScriptManagerModal';
import BodyEditor from './components/BodyEditor';
import ScriptTab from './components/ScriptTab';
import ResponsePanel from './components/ResponsePanel';
import HistoryPanel from './components/HistoryPanel';
import SettingsPanel from './components/SettingsPanel';
import ResizableSplitter from './components/ResizableSplitter';
import FolderSidebar from './components/FolderSidebar';
import CurlPanel from './components/CurlPanel';
import VerticalResizableSplitter from './components/VerticalResizableSplitter';
import TabBar from './components/TabBar';
import SaveRequestModal from './components/SaveRequestModal';
import { defaultRequestNameFromUrl } from './utils/requestName';
import { isTauri, setupTauriMenu } from './tauri/setupMenu';
import { bootstrapLocalStorage } from './utils/bootstrapStorage';
import { initSessionPersistence } from './utils/sessionStorage';
import { focusFolderSearchInput } from './utils/focusFolderSearch';
import { cloneHttpRequest } from './utils/normalizeRequest';

export default function App() {
  const { activeTab, setActiveTab, createTab, closeTab, switchToPreviousTab, switchToNextTab, tabs, activeTabId } =
    useStore(
      useShallow((s) => ({
        activeTab: s.activeTab,
        setActiveTab: s.setActiveTab,
        createTab: s.createTab,
        closeTab: s.closeTab,
        switchToPreviousTab: s.switchToPreviousTab,
        switchToNextTab: s.switchToNextTab,
        tabs: s.tabs,
        activeTabId: s.activeTabId,
      })),
    );
  const hasRequestTab = useStore(
    (s) => s.activeTabId != null && s.tabs.some((t) => t.id === s.activeTabId),
  );
  const preScriptId = useStore(
    (s) => s.tabs.find((t) => t.id === s.activeTabId)?.request.preScriptId ?? null,
  );
  const {
    theme,
    locale,
    responseHeight,
    dataDir,
    curlPanelOpen,
    curlPanelWidth,
    setCurlPanelWidth,
    curlPanelCollapsed,
    folderSidebarOpen,
    folderSidebarWidth,
    setFolderSidebarWidth,
    setFolderSidebarOpen,
  } = useSettingsStore();

  useEffect(() => {
    void bootstrapLocalStorage().catch((err) => {
      console.error('Failed to bootstrap local storage:', err);
    });
  }, [dataDir]);

  useEffect(() => {
    const cleanup = initSessionPersistence();
    return cleanup;
  }, []);

  useEffect(() => {
    const onFocusFolderSearch = () => {
      setFolderSidebarOpen(true);
      requestAnimationFrame(() => focusFolderSearchInput());
    };
    window.addEventListener('app:focus-folder-search', onFocusFolderSearch);
    return () => window.removeEventListener('app:focus-folder-search', onFocusFolderSearch);
  }, [setFolderSidebarOpen]);

  useEffect(() => {
    useStore.getState().syncHistoryRetention();
  }, []);

  const [toast, setToast] = useState('');
  const [saveModalOpen, setSaveModalOpen] = useState(false);

  // Close save modal on Escape
  useEffect(() => {
    if (!saveModalOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (document.activeElement?.id === 'save-request-name') return;
      setSaveModalOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [saveModalOpen]);

  useEffect(() => {
    const onToast = (e: Event) => {
      const message = (e as CustomEvent<string>).detail;
      if (!message) return;
      setToast(message);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(''), 2000);
    };
    window.addEventListener('app:toast', onToast);
    return () => window.removeEventListener('app:toast', onToast);
  }, []);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeTabForSave = tabs.find((t) => t.id === activeTabId);
  const saveModalDefaultName =
    defaultRequestNameFromUrl(activeTabForSave?.request.url ?? '') ||
    activeTabForSave?.name ||
    'New Request';

  const saveActiveTabToFolder = (requestNodeId: string, name: string) => {
    const activeTab = useStore.getState().tabs.find(t => t.id === useStore.getState().activeTabId);
    if (!activeTab) return false;
    const req = activeTab.request;
    useFolderStore.getState().updateRequest(requestNodeId, name, cloneHttpRequest(req));
    if (activeTab.requestNodeId !== requestNodeId) {
      const path = getFolderPath(useFolderStore.getState().folders, requestNodeId);
      useStore.getState().linkActiveTabToFolder(requestNodeId, name, path);
    } else {
      useStore.getState().clearUnsaved();
    }
    return true;
  };

  const handleSaveRequest = (folderId: string | null, name: string) => {
    const activeTab = useStore.getState().tabs.find(t => t.id === useStore.getState().activeTabId);
    if (!activeTab) return;
    const req = activeTab.request;
    const requestId = nanoid();
    const folderStore = useFolderStore.getState();
    const savedId = folderStore.addRequest(
      folderId,
      name,
      cloneHttpRequest(req),
      requestId,
      { startRename: false },
    );
    if (!savedId) return;
    folderStore.consumePendingRename();
    const path = getFolderPath(useFolderStore.getState().folders, savedId);
    useStore.getState().linkActiveTabToFolder(savedId, name, path);
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
  const switchToPreviousTabRef = useRef(switchToPreviousTab);
  const switchToNextTabRef = useRef(switchToNextTab);
  const tabsRef = useRef(tabs);
  const activeTabIdRef = useRef(activeTabId);

  useEffect(() => {
    createTabRef.current = createTab;
    closeTabRef.current = closeTab;
    switchToPreviousTabRef.current = switchToPreviousTab;
    switchToNextTabRef.current = switchToNextTab;
    tabsRef.current = tabs;
    activeTabIdRef.current = activeTabId;
  }, [createTab, closeTab, switchToPreviousTab, switchToNextTab, tabs, activeTabId]);

  useEffect(() => {
    const removeKeyboardShortcuts = initKeyboardShortcuts();
    const removeTextNavigationKeys = initTextNavigationKeys();

    const onNewTab = () => createTabRef.current();
    const onSaveRequest = () => {
      const tabState = useStore.getState();
      const activeTab = tabState.tabs.find(t => t.id === tabState.activeTabId);
      if (!activeTab) return;

      let requestNodeId = activeTab.requestNodeId;
      let name = activeTab.name;
      if (!requestNodeId) {
        const activeNodeId = useFolderStore.getState().activeNodeId;
        if (activeNodeId) {
          const node = useFolderStore.getState().getRequestNode(activeNodeId);
          if (node) {
            requestNodeId = node.id;
            name = node.name;
          }
        }
      }

      if (requestNodeId && saveActiveTabToFolder(requestNodeId, name)) {
        setToast('Saved!');
        if (toastTimer.current) clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToast(''), 1500);
      } else {
        setSaveModalOpen(true);
      }
    };
    const onCloseTab = () => {
      if (activeTabIdRef.current && tabsRef.current.length > 0) {
        closeTabRef.current(activeTabIdRef.current);
        return;
      }
      invoke('force_close_window');
    };
    const onToggleSettings = () => {
      useSettingsStore.getState().setSettingsOpen(!useSettingsStore.getState().settingsOpen);
    };
    const onPrevTab = () => switchToPreviousTabRef.current();
    const onNextTab = () => switchToNextTabRef.current();

    window.addEventListener('shortcut:toggle-settings', onToggleSettings);
    window.addEventListener('shortcut:new-tab', onNewTab);
    window.addEventListener('shortcut:save-request', onSaveRequest);
    window.addEventListener('shortcut:close-tab', onCloseTab);
    window.addEventListener('shortcut:prev-tab', onPrevTab);
    window.addEventListener('shortcut:next-tab', onNextTab);

    const unlisteners: Array<() => void> = [];

    listen('native-close-requested', () => {
      if (activeTabIdRef.current && tabsRef.current.length > 0) {
        closeTabRef.current(activeTabIdRef.current);
        return;
      }
      invoke('force_close_window');
    }).then(fn => unlisteners.push(fn));

    let cleanupMenu: (() => void) | undefined;
    if (isTauri()) {
      setupTauriMenu({
        onNewTab,
        onCloseTab,
        onPrevTab,
        onNextTab,
        onToggleSettings,
      })
        .then(cleanup => { cleanupMenu = cleanup; })
        .catch(err => console.error('Failed to setup Tauri menu:', err));
    }

    return () => {
      removeKeyboardShortcuts();
      removeTextNavigationKeys();
      window.removeEventListener('shortcut:toggle-settings', onToggleSettings);
      window.removeEventListener('shortcut:new-tab', onNewTab);
      window.removeEventListener('shortcut:save-request', onSaveRequest);
      window.removeEventListener('shortcut:close-tab', onCloseTab);
      window.removeEventListener('shortcut:prev-tab', onPrevTab);
      window.removeEventListener('shortcut:next-tab', onNextTab);
      unlisteners.forEach(fn => fn());
      cleanupMenu?.();
    };
  }, []);

  return (
    <>
      <TitleBar />
      <div className="app-body">
        <div className="main-content">
        {folderSidebarOpen && (
          <>
            <FolderSidebar />
            <VerticalResizableSplitter
              side="left"
              width={folderSidebarWidth}
              onWidthChange={setFolderSidebarWidth}
              minWidth={180}
              maxWidth={560}
            />
          </>
        )}
        <div className="main-center">
        <div className="main-workspace">
          <TabBar />
          <div className="main-workspace-body">
            {hasRequestTab ? (
              <>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
                  <div className="request-toolbar-group">
                    <UrlBar />
                  </div>
                  <div className="tabs">
                    <span className={`tab ${activeTab === 'params' ? 'active' : ''}`} onClick={() => setActiveTab('params')}>{t('tab.params')}</span>
                    <span className={`tab ${activeTab === 'headers' ? 'active' : ''}`} onClick={() => setActiveTab('headers')}>{t('tab.headers')}</span>
                    <span className={`tab ${activeTab === 'body' ? 'active' : ''}`} onClick={() => setActiveTab('body')}>{t('tab.body')}</span>
                    {isTauri() && (
                      <span
                        className={`tab${activeTab === 'script' ? ' active' : ''}${preScriptId ? ' tab--script-bound' : ''}`}
                        onClick={() => setActiveTab('script')}
                      >
                        {t('tab.script')}
                      </span>
                    )}
                  </div>
                  <div style={{ flex: 1, borderBottom: '1px solid var(--border-color)', overflow: 'auto', minHeight: 0 }}>
                    {activeTab === 'params' && <ParamsTab />}
                    {activeTab === 'headers' && <HeadersTab />}
                    {activeTab === 'body' && <BodyEditor />}
                    {isTauri() && activeTab === 'script' && <ScriptTab />}
                  </div>
                </div>
                <ResizableSplitter />
                <div style={{ height: responseHeight, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <ResponsePanel />
                </div>
              </>
            ) : (
              <div className="workspace-empty">{t('app.noTab')}</div>
            )}
          </div>
        </div>
        {curlPanelOpen && (
          <>
            <VerticalResizableSplitter
              width={curlPanelWidth}
              onWidthChange={setCurlPanelWidth}
              disabled={curlPanelCollapsed}
            />
            <CurlPanel />
          </>
        )}
        </div>
        </div>
        <div className="app-history-dock">
          <HistoryPanel />
        </div>
      </div>
      <SettingsPanel />
      <EnvironmentModal />
      <ScriptManagerModal />
      {saveModalOpen && (
        <SaveRequestModal
          onClose={() => setSaveModalOpen(false)}
          onSave={handleSaveRequest}
          defaultName={saveModalDefaultName}
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
