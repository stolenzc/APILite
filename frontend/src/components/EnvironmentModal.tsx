import { useEffect, useState, useCallback } from 'react';
import { useEnvironmentStore } from '../store/useEnvironmentStore';
import { t } from '../i18n';
import { useModalOverlayDismiss } from '../utils/modalOverlayDismiss';

type EnvDragKind = 'row' | 'col';

type EnvDragState = { kind: EnvDragKind; id: string };

const ENV_DRAG_HOVER = 'env-matrix-drag-hover';

let envDrag: EnvDragState | null = null;
let envGhostEl: HTMLElement | null = null;
let envDropRowId: string | null = null;
let envDropColId: string | null = null;

function notifyEnvDragHover(): void {
  window.dispatchEvent(new CustomEvent(ENV_DRAG_HOVER));
}

function updateEnvGhostPos(e: MouseEvent): void {
  if (envGhostEl) {
    envGhostEl.style.left = `${e.clientX + 12}px`;
    envGhostEl.style.top = `${e.clientY + 12}px`;
  }
}

function resolveEnvDropTarget(clientX: number, clientY: number): void {
  envDropRowId = null;
  envDropColId = null;
  if (!envDrag) return;

  const el = document.elementFromPoint(clientX, clientY);
  if (!el) return;

  if (envDrag.kind === 'row') {
    const rowEl = el.closest('[data-env-row-id]') as HTMLElement | null;
    if (rowEl) envDropRowId = rowEl.getAttribute('data-env-row-id');
    return;
  }

  const colEl = el.closest('[data-env-col-id]') as HTMLElement | null;
  if (colEl) envDropColId = colEl.getAttribute('data-env-col-id');
}

function clearEnvDrag(): void {
  envDrag = null;
  envDropRowId = null;
  envDropColId = null;
  if (envGhostEl) {
    envGhostEl.remove();
    envGhostEl = null;
  }
}

function startEnvMouseDrag(
  e: React.MouseEvent,
  kind: EnvDragKind,
  id: string,
  label: string,
): void {
  if (e.button !== 0) return;
  e.preventDefault();
  e.stopPropagation();

  const startX = e.clientX;
  const startY = e.clientY;
  let lastX = startX;
  let lastY = startY;
  let dragging = false;
  envDrag = { kind, id };

  const onMouseMove = (ev: MouseEvent) => {
    lastX = ev.clientX;
    lastY = ev.clientY;
    const dx = ev.clientX - startX;
    const dy = ev.clientY - startY;
    if (!dragging && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) {
      dragging = true;
      const ghost = document.createElement('div');
      ghost.textContent = label;
      ghost.className = 'env-drag-ghost';
      document.body.appendChild(ghost);
      envGhostEl = ghost;
      updateEnvGhostPos(ev);
      notifyEnvDragHover();
    }
    if (dragging) {
      updateEnvGhostPos(ev);
      resolveEnvDropTarget(ev.clientX, ev.clientY);
      notifyEnvDragHover();
    }
  };

  const onMouseUp = () => {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);

    if (dragging && envDrag) {
      resolveEnvDropTarget(lastX, lastY);
      const { reorderVariableRows, reorderEnvironmentColumns } = useEnvironmentStore.getState();
      if (envDrag.kind === 'row' && envDropRowId && envDropRowId !== envDrag.id) {
        reorderVariableRows(envDrag.id, envDropRowId);
      }
      if (envDrag.kind === 'col' && envDropColId && envDropColId !== envDrag.id) {
        reorderEnvironmentColumns(envDrag.id, envDropColId);
      }
    }

    clearEnvDrag();
    notifyEnvDragHover();
  };

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--bg-input)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-color)',
  borderRadius: 4,
  padding: '6px 8px',
  fontSize: 12,
};

const monoInputStyle: React.CSSProperties = {
  ...inputStyle,
  fontFamily: 'var(--font-mono)',
};

function focusEnvInput(e: React.MouseEvent<HTMLInputElement>) {
  e.preventDefault();
  e.currentTarget.focus({ preventScroll: true });
}

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

  const [rowDropId, setRowDropId] = useState<string | null>(null);
  const [colDropId, setColDropId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const overlayDismiss = useModalOverlayDismiss(() => setEnvModalOpen(false));

  const syncDropHints = useCallback(() => {
    setIsDragging(envDrag !== null);
    setRowDropId(envDropRowId);
    setColDropId(envDropColId);
  }, []);

  useEffect(() => {
    if (!envModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEnvModalOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [envModalOpen, setEnvModalOpen]);

  useEffect(() => {
    const onHover = () => syncDropHints();
    window.addEventListener(ENV_DRAG_HOVER, onHover);
    return () => window.removeEventListener(ENV_DRAG_HOVER, onHover);
  }, [syncDropHints]);

  useEffect(() => {
    if (!envModalOpen) {
      clearEnvDrag();
      setIsDragging(false);
      setRowDropId(null);
      setColDropId(null);
    }
  }, [envModalOpen]);

  if (!envModalOpen) return null;

  const colSpan = environments.length + 2;

  return (
    <div className="modal-overlay env-modal-overlay" {...overlayDismiss}>
      <div className="modal modal--env-matrix" onClick={(e) => e.stopPropagation()}>
        <h3 className="env-modal-title">
          <span>{t('env.modalTitle')}</span>
          <button type="button" className="close-btn" onClick={() => setEnvModalOpen(false)} aria-label="Close">
            ×
          </button>
        </h3>
        <p className="env-modal-hint">{t('env.modalHint')}</p>
        <div className={`env-matrix-scroll${isDragging ? ' env-matrix-scroll--dragging' : ''}`}>
          <div className="env-matrix-scroll-inner">
          <table className="env-matrix-table">
            <thead>
              <tr>
                <th className="env-matrix-sticky-col">{t('env.varName')}</th>
                {environments.map((col) => (
                  <th
                    key={col.id}
                    data-env-col-id={col.id}
                    className={colDropId === col.id ? 'env-col-drop-target' : undefined}
                  >
                    <div className="env-matrix-col-head">
                      <span
                        className="env-drag-handle"
                        title={t('env.dragCol')}
                        onMouseDown={(e) => startEnvMouseDrag(e, 'col', col.id, col.name || t('env.unnamed'))}
                      >
                        ⋮⋮
                      </span>
                      <input
                        type="text"
                        value={col.name}
                        onChange={(e) => renameEnvironmentColumn(col.id, e.target.value)}
                        onMouseDown={focusEnvInput}
                        style={inputStyle}
                      />
                      <button
                        type="button"
                        className="btn btn-secondary env-col-delete"
                        disabled={environments.length <= 1}
                        onClick={() => removeEnvironmentColumn(col.id)}
                      >
                        {t('env.deleteCol')}
                      </button>
                    </div>
                  </th>
                ))}
                <th className="env-matrix-add-col">
                  <button type="button" className="env-matrix-add-btn" onClick={() => addEnvironmentColumn()}>
                    {t('env.addEnvColumn')}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {variables.map((row) => (
                <tr
                  key={row.id}
                  data-env-row-id={row.id}
                  className={rowDropId === row.id ? 'env-row-drop-target' : undefined}
                >
                  <td className="env-matrix-sticky-col">
                    <div className="env-matrix-row-head">
                      <span
                        className="env-drag-handle"
                        title={t('env.dragRow')}
                        onMouseDown={(e) => startEnvMouseDrag(e, 'row', row.id, row.key || t('env.unnamed'))}
                      >
                        ⋮⋮
                      </span>
                      <input
                        type="text"
                        placeholder="base_url"
                        value={row.key}
                        onChange={(e) => updateVariableKey(row.id, e.target.value)}
                        onMouseDown={focusEnvInput}
                        style={monoInputStyle}
                      />
                      <button
                        type="button"
                        className="remove-btn"
                        title={t('kv.remove')}
                        onClick={() => removeVariableRow(row.id)}
                      >
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
                        onMouseDown={focusEnvInput}
                        style={monoInputStyle}
                      />
                    </td>
                  ))}
                  <td className="env-matrix-add-col" />
                </tr>
              ))}
              <tr className="env-matrix-add-row">
                <td colSpan={colSpan}>
                  <button type="button" className="env-matrix-add-btn env-matrix-add-btn--row" onClick={() => addVariableRow()}>
                    {t('env.addVarRow')}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
          </div>
        </div>
        <div className="modal-actions env-modal-actions">
          <button type="button" className="btn btn-send" onClick={() => setEnvModalOpen(false)}>
            {t('env.modalDone')}
          </button>
        </div>
      </div>
    </div>
  );
}
