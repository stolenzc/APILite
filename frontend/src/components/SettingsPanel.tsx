import { open } from '@tauri-apps/plugin-dialog';
import { useSettingsStore } from '../store/useSettings';
import { themes } from '../themes';
import { t, getAvailableLocales, getLocale } from '../i18n';
import type { ShortcutConfig } from '../store/useSettings';

const SHORTCUT_LABELS: Record<keyof ShortcutConfig, string> = {
  sendRequest: 'shortcut.sendRequest',
  saveRequest: 'shortcut.saveRequest',
  importCurl: 'shortcut.importCurl',
  exportCurl: 'shortcut.exportCurl',
  focusUrl: 'shortcut.focusUrl',
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
    collectionDir, setCollectionDir,
    autoCompleteProtocol, setAutoCompleteProtocol,
  } = useSettingsStore();

  if (!settingsOpen) return null;

  return (
    <div className="settings-overlay" onClick={() => setSettingsOpen(false)}>
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
          <h4>{t('settings.collection')}</h4>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{
              flex: 1,
              fontSize: 12,
              color: collectionDir ? 'var(--text-primary)' : 'var(--text-muted)',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
              borderRadius: 4,
              padding: '6px 10px',
              fontFamily: 'var(--font-mono)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {collectionDir || t('settings.collection.notSet')}
            </span>
            <button
              className="btn btn-secondary"
              style={{ fontSize: 12, padding: '6px 12px', whiteSpace: 'nowrap' }}
              onClick={async () => {
                const selected = await open({ directory: true });
                if (selected) {
                  setCollectionDir(selected);
                }
              }}
            >
              {t('settings.collection.select')}
            </button>
            {collectionDir && (
              <button
                className="btn btn-secondary"
                style={{ fontSize: 12, padding: '6px 12px' }}
                onClick={() => setCollectionDir('')}
              >
                {t('settings.collection.clear')}
              </button>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
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
                checked={autoCompleteProtocol}
                onChange={e => setAutoCompleteProtocol(e.target.checked)}
                style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
              />
              {t('settings.autoProtocol')}
            </label>
          </div>
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
                      value={value}
                      onChange={e => updateShortcut(key as keyof ShortcutConfig, e.target.value)}
                      style={{
                        background: 'var(--bg-input)',
                        color: 'var(--accent)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 3,
                        padding: '4px 8px',
                        fontSize: 12,
                        fontFamily: 'var(--font-mono)',
                        width: 120,
                      }}
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
