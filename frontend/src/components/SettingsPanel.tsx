import { useCallback, useEffect } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { useSettingsStore } from '../store/useSettings';
import { themes } from '../themes';
import { t, getAvailableLocales } from '../i18n';
import type { ShortcutConfig } from '../store/useSettings';
import { useModalOverlayDismiss } from '../utils/modalOverlayDismiss';
import { COLLECTIONS_SUBDIR, ENVIRONMENTS_FILE, HISTORIES_SUBDIR } from '../utils/storagePaths';
import { HISTORY_DAY_FILE_PATTERN } from '../utils/historyStorage';

const SHORTCUT_LABELS: Record<keyof ShortcutConfig, string> = {
  sendRequest: 'shortcut.sendRequest',
  saveRequest: 'shortcut.saveRequest',
  exportCurl: 'shortcut.exportCurl',
  focusUrl: 'shortcut.focusUrl',
  focusCollectionSearch: 'shortcut.focusCollectionSearch',
  toggleSettings: 'shortcut.toggleSettings',
  newTab: 'shortcut.newTab',
  closeTab: 'shortcut.closeTab',
  prevTab: 'shortcut.prevTab',
  nextTab: 'shortcut.nextTab',
};

export default function SettingsPanel() {
  const {
    settingsOpen, setSettingsOpen,
    theme, setTheme,
    locale, setLocale,
    shortcuts, updateShortcut, resetShortcuts, resetSettings,
    autoCompleteProtocol, setAutoCompleteProtocol,
    dataDir, setDataDir,
    historyMaxAgeDays, setHistoryMaxAgeDays,
    historyMaxCount, setHistoryMaxCount,
  } = useSettingsStore();
  const overlayDismiss = useModalOverlayDismiss(() => setSettingsOpen(false));

  const handleSelectDataDir = useCallback(async () => {
    const selected = await open({ directory: true });
    if (selected) setDataDir(selected);
  }, [setDataDir]);

  useEffect(() => {
    if (!settingsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setSettingsOpen(false);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [settingsOpen, setSettingsOpen]);

  if (!settingsOpen) return null;

  return (
    <div className="settings-overlay" {...overlayDismiss}>
      <div className="settings-modal" onClick={e => e.stopPropagation()}>
        <h3>
          {t('app.settings')}
          <button className="close-btn" onClick={() => setSettingsOpen(false)}>×</button>
        </h3>

        <div className="settings-section">
          <h4>{t('settings.language')}</h4>
          <div style={{ display: 'flex', gap: 8 }}>
            {getAvailableLocales().map(loc => (
              <button
                key={loc.value}
                className={`btn ${locale === loc.value ? 'btn-send' : 'btn-secondary'}`}
                style={{ fontSize: 13, padding: '8px 20px' }}
                onClick={() => setLocale(loc.value)}
              >
                {loc.label}
              </button>
            ))}
          </div>
        </div>

        <div className="settings-section">
          <h4>{t('settings.theme')}</h4>
          <div className="theme-grid">
            {Object.entries(themes).map(([key, t_obj]) => (
              <div
                key={key}
                className={`theme-card ${theme === key ? 'active' : ''}`}
                onClick={() => setTheme(key)}
              >
                <div className="swatch" style={{
                  background: `linear-gradient(135deg, ${t_obj.colors['--bg-primary']} 50%, ${t_obj.colors['--accent']} 50%)`,
                }} />
                {t(`theme.${key}`)}
              </div>
            ))}
          </div>
        </div>

        <div className="settings-section">
          <h4>{t('settings.storage.title')}</h4>
          <p className="settings-storage-hint">{t('settings.storage.hint')}</p>
          <ul className="settings-storage-layout">
            <li><code>{COLLECTIONS_SUBDIR}/</code> — {t('settings.storage.collections')}</li>
            <li><code>{HISTORIES_SUBDIR}/{HISTORY_DAY_FILE_PATTERN}</code> — {t('settings.storage.histories')}</li>
            <li><code>{ENVIRONMENTS_FILE}</code> — {t('settings.storage.environments')}</li>
          </ul>
          <div className="settings-storage-dir">
            <span
              className="settings-storage-dir-path"
              title={dataDir || t('settings.storage.notSet')}
            >
              {dataDir || t('settings.storage.notSet')}
            </span>
            <div className="settings-storage-dir-actions">
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: 12, padding: '6px 12px' }}
                onClick={handleSelectDataDir}
              >
                {t('settings.storage.select')}
              </button>
              {dataDir && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: 12, padding: '6px 12px' }}
                  onClick={() => setDataDir('')}
                >
                  {t('settings.storage.clear')}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="settings-section">
          <h4>{t('settings.history.title')}</h4>
          <p className="settings-history-hint">{t('settings.history.hint')}</p>
          <div className="settings-history-retention">
            <label className="settings-history-field">
              <span>{t('settings.history.maxAgeDays')}</span>
              <input
                type="number"
                min={1}
                max={3650}
                value={historyMaxAgeDays}
                onChange={(e) => setHistoryMaxAgeDays(Number(e.target.value))}
              />
            </label>
            <label className="settings-history-field">
              <span>{t('settings.history.maxCount')}</span>
              <input
                type="number"
                min={50}
                max={10000}
                value={historyMaxCount}
                onChange={(e) => setHistoryMaxCount(Number(e.target.value))}
              />
            </label>
          </div>
        </div>

        <div className="settings-section">
          <h4>{t('settings.request')}</h4>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              color: 'var(--text-primary)',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              className="kv-checkbox-lg"
              checked={autoCompleteProtocol}
              onChange={e => setAutoCompleteProtocol(e.target.checked)}
            />
            {t('settings.autoProtocol')}
          </label>
        </div>

        <div className="settings-section">
          <h4>{t('settings.shortcuts')}</h4>
          <table className="shortcut-table">
            <tbody>
              {Object.entries(shortcuts).map(([key, value]) => (
                <tr key={key}>
                  <td>{t(SHORTCUT_LABELS[key as keyof ShortcutConfig])}</td>
                  <td>
                    <input
                      type="text"
                      className="shortcut-input"
                      value={value}
                      onChange={e => updateShortcut(key as keyof ShortcutConfig, e.target.value)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" style={{ fontSize: 12, padding: '6px 12px' }} onClick={resetShortcuts}>
              {t('settings.resetShortcuts')}
            </button>
            <button className="btn btn-secondary" style={{ fontSize: 12, padding: '6px 12px' }} onClick={resetSettings}>
              {t('settings.resetAll')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
