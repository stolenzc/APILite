import { useState, useEffect } from 'react';
import { useStore } from './store/useStore';
import { useSettingsStore, initKeyboardShortcuts } from './store/useSettings';
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

export default function App() {
  const { activeTab, setActiveTab } = useStore();
  const { theme, locale, settingsOpen, setSettingsOpen, responseHeight } = useSettingsStore();

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    setLocale(locale);
  }, [locale]);

  useEffect(() => {
    initKeyboardShortcuts();
  }, []);

  return (
    <>
      <div className="app-header">
        <img src="/logo.png" alt="Postlite" style={{ height: 28, borderRadius: 6 }} />
        <button className="btn btn-icon" onClick={() => setSettingsOpen(!settingsOpen)} title="Settings (Ctrl+,)">⚙</button>
      </div>
      <div className="main-content">
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Top area: fills remaining space above splitter */}
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
          {/* Bottom area: fixed height response panel */}
          <div style={{ height: responseHeight, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <ResponsePanel />
            <HistoryPanel />
          </div>
        </div>
      </div>
      <SettingsPanel />
    </>
  );
}
