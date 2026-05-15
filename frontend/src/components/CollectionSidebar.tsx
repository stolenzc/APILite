import { useState, useRef, useEffect, useCallback } from 'react';
import { nanoid } from 'nanoid';
import { useCollectionStore, getCollectionPath } from '../store/useCollection';
import { useStore } from '../store/useStore';
import type { CollectionNode, CollectionFolder } from '../types';
import { t } from '../i18n';
import { methodColors } from '../constants';

// Global drag state shared across all TreeNodes
let dragSourceId: string | null = null;
let dragGhostEl: HTMLElement | null = null;
let dragListenersAttached = false;

function updateGhostPos(e: MouseEvent) {
  if (dragGhostEl) {
    dragGhostEl.style.left = e.clientX + 12 + 'px';
    dragGhostEl.style.top = e.clientY + 12 + 'px';
  }
}

function TreeNode({ node, depth = 0 }: { node: CollectionNode; depth?: number }) {
  const {
    toggleCollapse, setActiveNode, activeNodeId,
    openContextMenu, closeContextMenu, contextMenu,
    deleteNode, cloneNode, addFolder, addRequest, renameNode, loadRequest,
    moveNode,
  } = useCollectionStore();
  const { openTabFromCollection } = useStore();

  const isFolder = node.type === 'folder';
  const isActive = activeNodeId === node.id;
  const [renaming, setRenaming] = useState(false);
  const [editName, setEditName] = useState(node.name);
  const [hovered, setHovered] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const nodeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (renaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [renaming]);

  const handleClick = useCallback(() => {
    if (isFolder) {
      toggleCollapse(node.id);
    } else {
      setActiveNode(node.id);
      const req = loadRequest(node.id);
      if (req) {
        const path = getCollectionPath(useCollectionStore.getState().collections, node.id);
        openTabFromCollection(req, node.name, path, node.id);
      }
    }
  }, [isFolder, node.id, node.name, toggleCollapse, setActiveNode, loadRequest, openTabFromCollection]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    openContextMenu(node.id, e.clientX, e.clientY);
  }, [node.id, openContextMenu]);

  const confirmRename = useCallback(() => {
    if (editName.trim()) renameNode(node.id, editName.trim());
    setRenaming(false);
  }, [editName, node.id, renameNode]);

  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') confirmRename();
    if (e.key === 'Escape') { setEditName(node.name); setRenaming(false); }
  }, [confirmRename, node.name]);

  // Custom drag: start on mousedown
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.tagName === 'BUTTON' || target.tagName === 'INPUT') return;
    e.preventDefault();

    const startX = e.clientX;
    const startY = e.clientY;
    let lastX = startX;
    let lastY = startY;
    let dragging = false;
    dragSourceId = node.id;

    const onMouseMove = (ev: MouseEvent) => {
      lastX = ev.clientX;
      lastY = ev.clientY;
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!dragging && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) {
        dragging = true;
        const ghost = document.createElement('div');
        ghost.textContent = node.name;
        ghost.style.cssText = `
          position: fixed; z-index: 9999; pointer-events: none;
          background: var(--bg-tertiary, #0f3460); color: var(--text-primary, #e0e0e0);
          border: 1px solid var(--accent, #e94560); border-radius: 4px;
          padding: 4px 10px; font-size: 12px; font-family: -apple-system, sans-serif;
          opacity: 0.9; white-space: nowrap;
        `;
        document.body.appendChild(ghost);
        dragGhostEl = ghost;
        updateGhostPos(ev);
      }
      if (dragging) {
        updateGhostPos(ev);
      }
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      dragListenersAttached = false;
      if (dragging && dragGhostEl) {
        dragGhostEl.remove();
        dragGhostEl = null;
        const el = document.elementFromPoint(lastX, lastY);
        const folderNode = el?.closest('[data-folder-id]');
        if (folderNode) {
          const targetId = folderNode.getAttribute('data-folder-id')!;
          if (targetId !== dragSourceId) {
            moveNode(dragSourceId!, targetId);
          }
        }
      }
      dragSourceId = null;
    };

    if (!dragListenersAttached) {
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      dragListenersAttached = true;
    }
  }, [node.id, node.name, moveNode]);

  // Track drag-over for folder drop targets
  const handleDragOver = useCallback((e: React.MouseEvent) => {
    if (!isFolder || !dragSourceId || dragSourceId === node.id) return;
    setDragOver(true);
  }, [isFolder, node.id]);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const ctxOpen = contextMenu?.nodeId === node.id;

  return (
    <div>
      <div
        ref={nodeRef}
        className={`tree-node ${isActive ? 'active' : ''} ${dragOver ? 'drag-over' : ''}`}
        style={{ paddingLeft: depth * 16 + 8, cursor: 'grab' }}
        data-folder-id={isFolder ? node.id : undefined}
        onClick={handleClick}
        onDoubleClick={() => { setEditName(node.name); setRenaming(true); }}
        onContextMenu={handleContextMenu}
        onMouseEnter={(e) => {
          setHovered(true);
          handleDragOver(e);
        }}
        onMouseLeave={() => {
          setHovered(false);
          handleDragLeave();
        }}
        onMouseDown={handleMouseDown}
      >
        <span className="tree-icon">
          {isFolder ? (node.collapsed ? '▶' : '▼') : '●'}
        </span>
        {isFolder ? (
          <span className="tree-folder">📁</span>
        ) : (
          <span className="tree-method" style={{ color: (methodColors as any)[node.request.method] }}>
            {node.request.method}
          </span>
        )}
        {renaming ? (
          <input
            ref={inputRef}
            className="tree-rename-input"
            value={editName}
            onChange={e => setEditName(e.target.value)}
            onBlur={confirmRename}
            onKeyDown={handleKey}
          />
        ) : (
          <span className="tree-name">{node.name}</span>
        )}
        {hovered && !renaming && (
          <span className="tree-actions">
            <button title={t('collection.addRequest')} onClick={e => {
              e.stopPropagation();
              const id = nanoid();
              addRequest(node.id, 'New Request', undefined, id);
              const req = useCollectionStore.getState().loadRequest(id)!;
              const path = getCollectionPath(useCollectionStore.getState().collections, id);
              openTabFromCollection(req, 'New Request', path, id);
            }}>+R</button>
            {isFolder && <button title={t('collection.addFolder')} onClick={e => { e.stopPropagation(); addFolder(node.id); }}>+F</button>}
          </span>
        )}
      </div>
      {isFolder && !node.collapsed && (
        <div>
          {node.children.map(child => (
            <TreeNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
      {ctxOpen && <ContextMenu nodeId={node.id} isFolder={isFolder} onStartRename={() => { setEditName(node.name); setRenaming(true); closeContextMenu(); }} />}
    </div>
  );
}

function ContextMenu({ nodeId, isFolder, onStartRename }: { nodeId: string; isFolder: boolean; onStartRename: () => void }) {
  const { closeContextMenu, deleteNode, cloneNode, addFolder, addRequest } = useCollectionStore();
  const { openTabFromCollection } = useStore();
  const menuRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeContextMenu();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [visible, closeContextMenu]);

  const action = (fn: () => void) => { closeContextMenu(); fn(); };

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{
        position: 'fixed',
        left: useCollectionStore.getState().contextMenu?.x ?? 0,
        top: useCollectionStore.getState().contextMenu?.y ?? 0,
        zIndex: 1000,
      }}
      onContextMenu={e => e.preventDefault()}
    >
      <div className="context-menu-item" onClick={() => action(onStartRename)}>
        {t('collection.rename')}
      </div>
      <div className="context-menu-item" onClick={() => action(() => cloneNode(nodeId))}>
        {t('collection.duplicate')}
      </div>
      <div className="context-menu-item" onClick={() => action(() => deleteNode(nodeId))}>
        {t('collection.delete')}
      </div>
      {isFolder && (
        <>
          <div className="context-menu-separator" />
          <div className="context-menu-item" onClick={() => action(() => addFolder(nodeId))}>
            {t('collection.addFolder')}
          </div>
          <div className="context-menu-item" onClick={() => {
            const id = nanoid();
            closeContextMenu();
            addRequest(nodeId, 'New Request', undefined, id);
            const req = useCollectionStore.getState().loadRequest(id)!;
            const path = getCollectionPath(useCollectionStore.getState().collections, id);
            openTabFromCollection(req, 'New Request', path, id);
          }}>
            {t('collection.addRequest')}
          </div>
        </>
      )}
    </div>
  );
}

export default function CollectionSidebar() {
  const { collections, addFolder, addRequest } = useCollectionStore();
  const { openTabFromCollection } = useStore();

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <span>{t('collection.title')}</span>
        <div className="sidebar-actions">
          <button title={t('collection.addFolder')} onClick={() => addFolder(null)}>+F</button>
          <button title={t('collection.addRequest')} onClick={() => {
            const id = nanoid();
            addRequest(null, 'New Request', undefined, id);
            const req = useCollectionStore.getState().loadRequest(id)!;
            openTabFromCollection(req, 'New Request', 'New Request', id);
          }}>+R</button>
        </div>
      </div>
      <div className="sidebar-body">
        {collections.length === 0 && (
          <div className="sidebar-placeholder">{t('collection.empty')}</div>
        )}
        {collections.map(node => (
          <TreeNode key={node.id} node={node} />
        ))}
      </div>
    </div>
  );
}
