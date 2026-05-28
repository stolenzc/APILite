import { useCallback, useEffect, useState } from 'react';
import { useScriptStore } from '../store/useScriptStore';
import { useModalOverlayDismiss } from '../utils/modalOverlayDismiss';
import { t } from '../i18n';
import { isTauri } from '../tauri/setupMenu';

export default function ScriptManagerModal() {
  const open = useScriptStore((s) => s.managerOpen);
  const setManagerOpen = useScriptStore((s) => s.setManagerOpen);
  const scripts = useScriptStore((s) => s.scripts);
  const venvReady = useScriptStore((s) => s.venvReady);
  const scriptsDirPath = useScriptStore((s) => s.scriptsDirPath);
  const createScript = useScriptStore((s) => s.createScript);
  const updateScript = useScriptStore((s) => s.updateScript);
  const deleteScript = useScriptStore((s) => s.deleteScript);
  const readSource = useScriptStore((s) => s.readSource);
  const refreshVenv = useScriptStore((s) => s.refreshVenv);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [source, setSource] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const selected = scripts.find((s) => s.id === selectedId) ?? null;

  const loadEditor = useCallback(
    async (id: string) => {
      const entry = scripts.find((s) => s.id === id);
      if (!entry) return;
      setSelectedId(id);
      setName(entry.name);
      setDescription(entry.description);
      setDirty(false);
      try {
        const code = await readSource(id);
        setSource(code);
      } catch {
        setSource('');
      }
    },
    [scripts, readSource],
  );

  useEffect(() => {
    if (!open) return;
    void refreshVenv();
    if (scripts.length > 0 && !selectedId) {
      void loadEditor(scripts[0].id);
    }
  }, [open, scripts, selectedId, loadEditor, refreshVenv]);

  const overlayDismiss = useModalOverlayDismiss(() => setManagerOpen(false));

  if (!open) return null;

  const handleCreate = async () => {
    const entry = await createScript(t('scripts.newName'), '');
    await loadEditor(entry.id);
  };

  const handleSave = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      await updateScript(selectedId, { name, description, source });
      setDirty(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    if (!window.confirm(t('scripts.deleteConfirm'))) return;
    await deleteScript(selectedId);
    const remaining = useScriptStore.getState().scripts;
    if (remaining[0]) await loadEditor(remaining[0].id);
    else {
      setSelectedId(null);
      setName('');
      setDescription('');
      setSource('');
    }
  };

  return (
    <div className="modal-overlay script-modal-overlay" {...overlayDismiss}>
      <div className="modal modal--scripts" onClick={(e) => e.stopPropagation()}>
        <h3 className="script-modal-title">
          <span>{t('scripts.modalTitle')}</span>
          <button type="button" className="close-btn" onClick={() => setManagerOpen(false)} aria-label="Close">
            ×
          </button>
        </h3>
        <p className="script-modal-hint">{t('scripts.modalHint')}</p>
        {!isTauri() && <p className="script-modal-warn">{t('scripts.desktopOnly')}</p>}
        <p className={`script-venv-status${venvReady ? ' script-venv-status--ok' : ''}`}>
          {venvReady ? t('scripts.venvReady') : t('scripts.venvMissing')}
          {scriptsDirPath ? (
            <>
              <br />
              <code className="script-dir-path">{scriptsDirPath}</code>
            </>
          ) : null}
        </p>

        <div className="script-manager-layout">
          <div className="script-list-panel">
            <button type="button" className="btn btn-secondary script-list-add" onClick={() => void handleCreate()}>
              {t('scripts.add')}
            </button>
            <ul className="script-list">
              {scripts.map((sc) => (
                <li key={sc.id}>
                  <button
                    type="button"
                    className={`script-list-item${sc.id === selectedId ? ' active' : ''}`}
                    onClick={() => void loadEditor(sc.id)}
                  >
                    <span className="script-list-name">{sc.name}</span>
                    {sc.description ? (
                      <span className="script-list-desc">{sc.description}</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="script-editor-panel">
            {selected ? (
              <>
                <label className="script-field-label">
                  {t('scripts.name')}
                  <input
                    className="script-field-input"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setDirty(true);
                    }}
                  />
                </label>
                <label className="script-field-label">
                  {t('scripts.description')}
                  <input
                    className="script-field-input"
                    value={description}
                    onChange={(e) => {
                      setDescription(e.target.value);
                      setDirty(true);
                    }}
                    placeholder={t('scripts.descriptionPlaceholder')}
                  />
                </label>
                <label className="script-field-label">
                  {t('scripts.source')}
                  <textarea
                    className="script-source-editor"
                    value={source}
                    spellCheck={false}
                    onChange={(e) => {
                      setSource(e.target.value);
                      setDirty(true);
                    }}
                  />
                </label>
                <div className="script-editor-actions">
                  <button
                    type="button"
                    className="btn btn-send"
                    disabled={!dirty || saving}
                    onClick={() => void handleSave()}
                  >
                    {saving ? t('scripts.saving') : t('scripts.save')}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => void handleDelete()}>
                    {t('scripts.delete')}
                  </button>
                </div>
              </>
            ) : (
              <p className="script-editor-empty">{t('scripts.empty')}</p>
            )}
          </div>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-send" onClick={() => setManagerOpen(false)}>
            {t('scripts.done')}
          </button>
        </div>
      </div>
    </div>
  );
}
