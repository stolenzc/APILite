import { getCurrentWindow } from '@tauri-apps/api/window';
import { toggleCurlPanelVisibility, useSettingsStore } from '../store/useSettings';
import { t } from '../i18n';
import { isTauri } from '../tauri/setupMenu';
import { PanelBottomIcon, PanelLeftIcon, PanelRightIcon } from './PanelToggleIcons';

export default function TitleBar() {
  const {
    shortcuts,
    settingsOpen,
    setSettingsOpen,
    curlPanelOpen,
    collectionSidebarOpen,
    setCollectionSidebarOpen,
    historyCollapsed,
    setHistoryCollapsed,
  } = useSettingsStore();

  const startDrag = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    if (!isTauri()) return;
    e.preventDefault();
    void getCurrentWindow().startDragging();
  };

  return (
    <div
      className={`app-titlebar${isTauri() ? ' app-titlebar--tauri' : ''}`}
      onMouseDown={startDrag}
    >
      <div className="app-titlebar-drag" data-tauri-drag-region />
      <div className="app-titlebar-actions">
        <button
          type="button"
          className="btn btn-icon app-titlebar-btn"
          onClick={() => setCollectionSidebarOpen(!collectionSidebarOpen)}
          title={`${t('app.toggleCollections')} (${shortcuts.toggleCollectionSidebar})`}
          aria-label={t('app.toggleCollections')}
          aria-pressed={collectionSidebarOpen}
        >
          <PanelLeftIcon active={collectionSidebarOpen} />
        </button>
        <button
          type="button"
          className="btn btn-icon app-titlebar-btn"
          onClick={() => setHistoryCollapsed(!historyCollapsed)}
          title={`${t('app.toggleHistoryPanel')} (${shortcuts.toggleHistory})`}
          aria-label={t('app.toggleHistoryPanel')}
          aria-pressed={!historyCollapsed}
        >
          <PanelBottomIcon active={!historyCollapsed} />
        </button>
        <button
          type="button"
          className="btn btn-icon app-titlebar-btn"
          onClick={toggleCurlPanelVisibility}
          title={`${t('app.toggleCurlPanel')} (${shortcuts.toggleCurlPanel})`}
          aria-label={t('app.toggleCurlPanel')}
          aria-pressed={curlPanelOpen}
        >
          <PanelRightIcon active={curlPanelOpen} />
        </button>
        <button
          type="button"
          className="btn btn-icon app-titlebar-btn"
          onClick={() => setSettingsOpen(!settingsOpen)}
          title={`${t('app.settings')} (${shortcuts.toggleSettings})`}
          aria-pressed={settingsOpen}
        >
          ⚙
        </button>
      </div>
    </div>
  );
}
