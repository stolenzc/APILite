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
  const varEntries = Object.entries(scriptVars);

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

      {varEntries.length > 0 && (
        <div className="script-tab-section">
          <h4 className="script-tab-vars-title">{t('scripts.varsTitle')}</h4>
          <p className="script-tab-hint">{t('scripts.varsHint')}</p>
          <table className="kv-table script-tab-vars-table">
            <thead>
              <tr>
                <th>{t('kv.key')}</th>
                <th>{t('kv.value')}</th>
              </tr>
            </thead>
            <tbody>
              {varEntries.map(([key, value]) => (
                <tr key={key}>
                  <td>
                    <code>{`{{${key}}}`}</code>
                  </td>
                  <td className="script-tab-var-value">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
