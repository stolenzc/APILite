import { useMemo } from 'react';
import { useStore } from '../store/useStore';
import { useScriptStore } from '../store/useScriptStore';
import { t } from '../i18n';

export default function ScriptTab() {
  const scripts = useScriptStore((s) => s.scripts);
  const setManagerOpen = useScriptStore((s) => s.setManagerOpen);
  const preScriptId = useStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.request.preScriptId ?? null);
  const setPreScriptId = useStore((s) => s.setPreScriptId);
  const scriptVars = useStore((s) => {
    const tab = s.tabs.find((t) => t.id === s.activeTabId);
    return tab?.scriptVars ?? {};
  });

  const selected = scripts.find((sc) => sc.id === preScriptId) ?? null;
  const varEntries = useMemo(
    () => Object.entries(scriptVars).sort(([a], [b]) => a.localeCompare(b)),
    [scriptVars],
  );

  return (
    <div className="script-tab">
      <div className="script-tab-section">
        <p className="script-tab-hint">{t('scripts.preHint')}</p>
        <div className="script-tab-row">
          <label className="script-tab-label" htmlFor="request-pre-script-select">
            {t('scripts.preSelect')}
          </label>
          <select
            id="request-pre-script-select"
            className="script-tab-select"
            value={preScriptId ?? ''}
            onChange={(e) => setPreScriptId(e.target.value || null)}
          >
            <option value="">{t('scripts.preNone')}</option>
            {scripts.map((sc) => (
              <option key={sc.id} value={sc.id}>
                {sc.name}
              </option>
            ))}
          </select>
          <button type="button" className="btn btn-secondary script-tab-manage" onClick={() => setManagerOpen(true)}>
            {t('scripts.manage')}
          </button>
        </div>
        {selected?.description ? (
          <p className="script-tab-desc">{selected.description}</p>
        ) : null}
      </div>

      <div className="script-tab-section script-tab-section--vars">
        <div className="script-vars-header">
          <h4 className="script-tab-vars-title">{t('scripts.varsTitle')}</h4>
          {varEntries.length > 0 && (
            <span className="script-vars-count">
              {t('scripts.varsCount').replace('{count}', String(varEntries.length))}
            </span>
          )}
        </div>
        <p className="script-tab-hint">{t('scripts.varsHint')}</p>

        {varEntries.length === 0 ? (
          <p className="script-vars-empty">{t('scripts.varsEmpty')}</p>
        ) : (
          <div className="script-vars-scroll">
            <table className="script-vars-table">
              <thead>
                <tr>
                  <th className="script-vars-th-name">{t('scripts.varsColPlaceholder')}</th>
                  <th className="script-vars-th-value">{t('kv.value')}</th>
                </tr>
              </thead>
              <tbody>
                {varEntries.map(([key, value]) => (
                  <tr key={key}>
                    <td className="script-vars-td-name">
                      <code className="script-var-placeholder" title={key}>
                        {`{{${key}}}`}
                      </code>
                    </td>
                    <td className="script-vars-td-value">
                      <span className="script-var-value" title={value}>
                        {value}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
