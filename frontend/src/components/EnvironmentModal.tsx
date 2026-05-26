import { useEffect, useState, useCallback, useRef } from 'react';
import { useEnvironmentStore } from '../store/useEnvironmentStore';
import { isVariableInEnv } from '../utils/environmentScope';
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

type EnvCtxMenu =
  | { kind: 'col'; id: string; x: number; y: number }
  | { kind: 'row'; id: string; x: number; y: number }
  | { kind: 'cell'; rowId: string; envId: string; inEnv: boolean; x: number; y: number };

function EnvContextMenu({
  menu,
  canDeleteCol,
  onClose,
  onDuplicateCol,
  onDeleteCol,
  onDuplicateRow,
  onDeleteRow,
  onEnableInEnv,
  onRemoveFromEnv,
  onScopeToEnvOnly,
}: {
  menu: EnvCtxMenu;
  canDeleteCol: boolean;
  onClose: () => void;
  onDuplicateCol: (id: string) => void;
  onDeleteCol: (id: string) => void;
  onDuplicateRow: (id: string) => void;
  onDeleteRow: (id: string) => void;
  onEnableInEnv: (rowId: string, envId: string) => void;
  onRemoveFromEnv: (rowId: string, envId: string) => void;
  onScopeToEnvOnly: (rowId: string, envId: string) => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const run = (fn: () => void) => {
    onClose();
    fn();
  };

  if (menu.kind === 'cell') {
    return (
      <div
        ref={menuRef}
        className="context-menu env-context-menu"
        style={{ left: menu.x, top: menu.y }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {menu.inEnv ? (
          <>
            <div
              className="context-menu-item"
              onClick={() => run(() => onScopeToEnvOnly(menu.rowId, menu.envId))}
            >
              {t('env.scopeToEnvOnly')}
            </div>
            <div
              className="context-menu-item"
              onClick={() => run(() => onRemoveFromEnv(menu.rowId, menu.envId))}
            >
              {t('env.removeFromEnv')}
            </div>
          </>
        ) : (
          <div
            className="context-menu-item"
            onClick={() => run(() => onEnableInEnv(menu.rowId, menu.envId))}
          >
            {t('env.enableInEnv')}
          </div>
        )}
      </div>
    );
  }

  const isCol = menu.kind === 'col';

  return (
    <div
      ref={menuRef}
      className="context-menu env-context-menu"
      style={{ left: menu.x, top: menu.y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        className="context-menu-item"
        onClick={() => run(() => (isCol ? onDuplicateCol(menu.id) : onDuplicateRow(menu.id)))}
      >
        {t('folder.duplicate')}
      </div>
      <div
        className={`context-menu-item${isCol && !canDeleteCol ? ' context-menu-item--disabled' : ''}`}
        onClick={() => {
          if (isCol && !canDeleteCol) return;
          run(() => (isCol ? onDeleteCol(menu.id) : onDeleteRow(menu.id)));
        }}
      >
        {t('folder.delete')}
      </div>
    </div>
  );
}

export default function EnvironmentModal() {
  const {
    envModalOpen,
    setEnvModalOpen,
    environments,
    variables,
    addEnvironmentColumn,
    removeEnvironmentColumn,
    duplicateEnvironmentColumn,
    renameEnvironmentColumn,
    addVariableRow,
    removeVariableRow,
    duplicateVariableRow,
    updateVariableKey,
    updateCell,
    setVariableInEnv,
    scopeVariableToEnvOnly,
  } = useEnvironmentStore();

  const [rowDropId, setRowDropId] = useState<string | null>(null);
  const [colDropId, setColDropId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [contextMenu, setContextMenu] = useState<EnvCtxMenu | null>(null);
  const overlayDismiss = useModalOverlayDismiss(() => setEnvModalOpen(false));

  const openContextMenu = useCallback((e: React.MouseEvent, kind: 'col' | 'row', id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ kind, id, x: e.clientX, y: e.clientY });
  }, []);

  const openCellContextMenu = useCallback(
    (e: React.MouseEvent, rowId: string, envId: string, inEnv: boolean) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ kind: 'cell', rowId, envId, inEnv, x: e.clientX, y: e.clientY });
    },
    [],
  );

  const syncDropHints = useCallback(() => {
    setIsDragging(envDrag !== null);
    setRowDropId(envDropRowId);
    setColDropId(envDropColId);
  }, []);

  useEffect(() => {
    if (!envModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (contextMenu) setContextMenu(null);
        else setEnvModalOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [envModalOpen, setEnvModalOpen, contextMenu]);

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
      setContextMenu(null);
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
        <p className="env-modal-hint">
          {t('env.modalHint')}
          {' '}
          {t('env.contextMenu')}
        </p>
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
                    onContextMenu={(e) => openContextMenu(e, 'col', col.id)}
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
                  onContextMenu={(e) => openContextMenu(e, 'row', row.id)}
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
                    </div>
                  </td>
                  {environments.map((col) => {
                    const inEnv = isVariableInEnv(row, col.id);
                    return (
                      <td
                        key={col.id}
                        className={inEnv ? undefined : 'env-matrix-cell--absent'}
                        onContextMenu={(e) => openCellContextMenu(e, row.id, col.id, inEnv)}
                      >
                        {inEnv ? (
                          <input
                            type="text"
                            placeholder="{{base_url}}:8001"
                            value={row.valuesByEnvId[col.id] ?? ''}
                            onChange={(e) => updateCell(row.id, col.id, e.target.value)}
                            onMouseDown={focusEnvInput}
                            style={monoInputStyle}
                          />
                        ) : (
                          <button
                            type="button"
                            className="env-matrix-cell-absent-btn"
                            title={t('env.enableInEnv')}
                            onClick={() => setVariableInEnv(row.id, col.id, true)}
                          >
                            —
                          </button>
                        )}
                      </td>
                    );
                  })}
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
      {contextMenu && (
        <EnvContextMenu
          menu={contextMenu}
          canDeleteCol={environments.length > 1}
          onClose={() => setContextMenu(null)}
          onDuplicateCol={duplicateEnvironmentColumn}
          onDeleteCol={removeEnvironmentColumn}
          onDuplicateRow={duplicateVariableRow}
          onDeleteRow={removeVariableRow}
          onEnableInEnv={(rowId, envId) => setVariableInEnv(rowId, envId, true)}
          onRemoveFromEnv={(rowId, envId) => setVariableInEnv(rowId, envId, false)}
          onScopeToEnvOnly={scopeVariableToEnvOnly}
        />
      )}
    </div>
  );
}
