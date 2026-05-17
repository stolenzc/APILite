import { useEffect } from 'react';
import { useEnvironmentStore } from '../store/useEnvironmentStore';
import { t } from '../i18n';

export default function EnvironmentModal() {
  const {
    envModalOpen,
    setEnvModalOpen,
    environments,
    variables,
    addEnvironmentColumn,
    removeEnvironmentColumn,
    renameEnvironmentColumn,
    addVariableRow,
    removeVariableRow,
    updateVariableKey,
    updateCell,
  } = useEnvironmentStore();

  useEffect(() => {
    if (!envModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEnvModalOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [envModalOpen, setEnvModalOpen]);

  if (!envModalOpen) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 120 }} onClick={() => setEnvModalOpen(false)}>
      <div className="modal modal--env-matrix" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{t('env.modalTitle')}</span>
          <button type="button" className="close-btn" onClick={() => setEnvModalOpen(false)} aria-label="Close">
            ×
          </button>
        </h3>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.55, marginBottom: 12 }}>
          {t('env.modalHint')}
        </p>

        <div style={{ marginBottom: 10, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <button type="button" className="btn btn-secondary" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => addEnvironmentColumn()}>
            {t('env.addEnvColumn')}
          </button>
          <button type="button" className="btn btn-secondary" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => addVariableRow()}>
            {t('env.addVarRow')}
          </button>
        </div>

        <div className="env-matrix-scroll">
          <table className="env-matrix-table">
            <thead>
              <tr>
                <th className="env-matrix-sticky-col">{t('env.varName')}</th>
                {environments.map((col) => (
                  <th key={col.id}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 140 }}>
                      <input
                        type="text"
                        value={col.name}
                        onChange={(e) => renameEnvironmentColumn(col.id, e.target.value)}
                        style={{
                          width: '100%',
                          background: 'var(--bg-input)',
                          color: 'var(--text-primary)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 4,
                          padding: '6px 8px',
                          fontSize: 12,
                        }}
                      />
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ fontSize: 11, padding: '4px 8px', alignSelf: 'flex-start' }}
                        disabled={environments.length <= 1}
                        onClick={() => removeEnvironmentColumn(col.id)}
                      >
                        {t('env.deleteCol')}
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {variables.map((row) => (
                <tr key={row.id}>
                  <td className="env-matrix-sticky-col">
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input
                        type="text"
                        placeholder="base_url"
                        value={row.key}
                        onChange={(e) => updateVariableKey(row.id, e.target.value)}
                        style={{
                          flex: 1,
                          minWidth: 100,
                          background: 'var(--bg-input)',
                          color: 'var(--text-primary)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 4,
                          padding: '6px 8px',
                          fontSize: 12,
                          fontFamily: 'var(--font-mono)',
                        }}
                      />
                      <button type="button" className="remove-btn" title={t('kv.remove')} onClick={() => removeVariableRow(row.id)}>
                        ×
                      </button>
                    </div>
                  </td>
                  {environments.map((col) => (
                    <td key={col.id}>
                      <input
                        type="text"
                        placeholder="{{base_url}}:8001"
                        value={row.valuesByEnvId[col.id] ?? ''}
                        onChange={(e) => updateCell(row.id, col.id, e.target.value)}
                        style={{
                          width: '100%',
                          minWidth: 140,
                          background: 'var(--bg-input)',
                          color: 'var(--text-primary)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 4,
                          padding: '6px 8px',
                          fontSize: 12,
                          fontFamily: 'var(--font-mono)',
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="modal-actions" style={{ marginTop: 16 }}>
          <button type="button" className="btn btn-send" onClick={() => setEnvModalOpen(false)}>
            {t('env.modalDone')}
          </button>
        </div>
      </div>
    </div>
  );
}
