import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { nanoid } from 'nanoid';
import { useCollectionStore, getCollectionPath } from '../store/useCollection';
import { useStore } from '../store/useStore';
import type { CollectionFolder, CollectionNode, CollectionRequest } from '../types';
import { t } from '../i18n';
import { methodColors } from '../constants';

// Global drag state shared across all TreeNodes
let dragSourceId: string | null = null;
let dragSourceIsFolder = false;
let dragGhostEl: HTMLElement | null = null;
let dragListenersAttached = false;
let dragDropTargetId: string | null = null;
let dragDropPosition: 'before' | 'after' | 'inside' | null = null;

const DRAG_HOVER_EVENT = 'collection-drag-hover';

function updateGhostPos(e: MouseEvent) {
  if (dragGhostEl) {
    dragGhostEl.style.left = e.clientX + 12 + 'px';
    dragGhostEl.style.top = e.clientY + 12 + 'px';
  }
}

function resolveDropTarget(clientX: number, clientY: number): void {
  dragDropTargetId = null;
  dragDropPosition = null;
  const el = document.elementFromPoint(clientX, clientY);
  if (!el) return;

  if (dragSourceIsFolder) {
    const folderEl = el.closest('[data-folder-id]') as HTMLElement | null;
    if (folderEl) {
      dragDropTargetId = folderEl.getAttribute('data-folder-id');
      dragDropPosition = 'inside';
    }
    return;
  }

  const requestEl = el.closest('[data-request-id]') as HTMLElement | null;
  if (requestEl) {
    dragDropTargetId = requestEl.getAttribute('data-request-id');
    const rect = requestEl.getBoundingClientRect();
    dragDropPosition = clientY < rect.top + rect.height / 2 ? 'before' : 'after';
    return;
  }

  const folderEl = el.closest('[data-folder-id]') as HTMLElement | null;
  if (folderEl) {
    dragDropTargetId = folderEl.getAttribute('data-folder-id');
    dragDropPosition = 'inside';
  }
}

function notifyDragHover(): void {
  window.dispatchEvent(new CustomEvent(DRAG_HOVER_EVENT));
}

function requestMatchesSearch(node: CollectionRequest, queryNorm: string): boolean {
  if (!queryNorm) return true;
  const url = node.request.url.toLowerCase();
  const name = node.name.toLowerCase();
  return name.includes(queryNorm) || url.includes(queryNorm);
}

function folderNameMatches(node: { name: string }, queryNorm: string): boolean {
  if (!queryNorm) return false;
  return node.name.toLowerCase().includes(queryNorm);
}

/** Deep copy folder nodes with collapsed=false so search results stay expanded. */
function withFoldersExpandedForSearch(nodes: CollectionNode[]): CollectionNode[] {
  return nodes.map(n => {
    if (n.type === 'request') return n;
    return {
      ...n,
      collapsed: false,
      children: withFoldersExpandedForSearch(n.children),
    };
  });
}

/**
 * Filter tree: requests match by name/URL; folders & collection roots match by name.
 * If a folder name matches, include its full subtree (all descendants).
 */
function filterCollectionTree(nodes: CollectionNode[], query: string): CollectionNode[] {
  const q = query.trim();
  if (!q) return nodes;
  const qn = q.toLowerCase();

  const walk = (list: CollectionNode[]): CollectionNode[] => {
    const out: CollectionNode[] = [];
    for (const node of list) {
      if (node.type === 'request') {
        if (requestMatchesSearch(node, qn)) out.push(node);
      } else {
        const nameHit = folderNameMatches(node, qn);
        const filteredChildren = walk(node.children);
        if (nameHit) {
          out.push({
            ...node,
            collapsed: false,
            children: withFoldersExpandedForSearch(node.children),
          });
        } else if (filteredChildren.length > 0) {
          out.push({
            ...node,
            collapsed: false,
            children: filteredChildren,
          });
        }
      }
    }
    return out;
  };
  return walk(nodes);
}

function TreeNode({ node, depth = 0 }: { node: CollectionNode; depth?: number }) {
  const {
    toggleCollapse, setActiveNode, activeNodeId,
    openContextMenu, closeContextMenu, contextMenu,
    deleteNode, cloneNode, addFolder, addRequest, renameNode, loadRequest,
    moveRequest, moveFolder, pendingRenameNodeId, consumePendingRename,
  } = useCollectionStore();
  const { openTabFromCollection } = useStore();

  const isFolder = node.type === 'folder';
  const isCollectionRoot = isFolder && !!(node as CollectionFolder).fileName;
  const canDrag = !isCollectionRoot;
  const isActive = activeNodeId === node.id;
  const [renaming, setRenaming] = useState(false);
  const [editName, setEditName] = useState(node.name);
  const [hovered, setHovered] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [dropHint, setDropHint] = useState<'before' | 'after' | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nodeRef = useRef<HTMLDivElement>(null);

  const syncDropHint = useCallback(() => {
    if (!dragSourceId || dragDropTargetId !== node.id) {
      setDropHint(null);
      setDragOver(false);
      return;
    }
    if (isFolder) {
      setDropHint(null);
      setDragOver(dragDropPosition === 'inside');
      return;
    }
    setDragOver(false);
    setDropHint(dragDropPosition === 'before' || dragDropPosition === 'after' ? dragDropPosition : null);
  }, [isFolder, node.id]);

  useEffect(() => {
    const onDragHover = () => syncDropHint();
    window.addEventListener(DRAG_HOVER_EVENT, onDragHover);
    return () => window.removeEventListener(DRAG_HOVER_EVENT, onDragHover);
  }, [syncDropHint]);

  useEffect(() => {
    if (renaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [renaming]);

  useEffect(() => {
    if (pendingRenameNodeId !== node.id) return;
    setEditName(node.name);
    setRenaming(true);
    consumePendingRename();
  }, [pendingRenameNodeId, node.id, node.name, consumePendingRename]);

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
    const next = editName.trim();
    if (next && !renameNode(node.id, next)) {
      setEditName(node.name);
    }
    setRenaming(false);
  }, [editName, node.id, node.name, renameNode]);

  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') confirmRename();
    if (e.key === 'Escape') { setEditName(node.name); setRenaming(false); }
  }, [confirmRename, node.name]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!canDrag) return;
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
    dragSourceIsFolder = isFolder;

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
        resolveDropTarget(ev.clientX, ev.clientY);
        notifyDragHover();
      }
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      dragListenersAttached = false;
      if (dragging && dragGhostEl) {
        dragGhostEl.remove();
        dragGhostEl = null;
        resolveDropTarget(lastX, lastY);
        if (dragSourceId && dragDropTargetId && dragDropTargetId !== dragSourceId) {
          if (dragSourceIsFolder && dragDropPosition === 'inside') {
            moveFolder(dragSourceId, dragDropTargetId);
          } else if (!dragSourceIsFolder && dragDropPosition) {
            moveRequest(dragSourceId, dragDropTargetId, dragDropPosition);
          }
        }
      }
      dragSourceId = null;
      dragSourceIsFolder = false;
      dragDropTargetId = null;
      dragDropPosition = null;
      notifyDragHover();
    };

    if (!dragListenersAttached) {
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      dragListenersAttached = true;
    }
  }, [canDrag, isFolder, node.id, node.name, moveRequest, moveFolder]);

  const ctxOpen = contextMenu?.nodeId === node.id;

  return (
    <div>
      <div
        ref={nodeRef}
        className={`tree-node ${isActive ? 'active' : ''} ${dragOver ? 'drag-over' : ''} ${dropHint === 'before' ? 'drop-before' : ''} ${dropHint === 'after' ? 'drop-after' : ''}`}
        style={{ paddingLeft: depth * 16 + 8, cursor: canDrag ? 'grab' : 'default' }}
        data-folder-id={isFolder ? node.id : undefined}
        data-request-id={!isFolder ? node.id : undefined}
        onClick={handleClick}
        onDoubleClick={() => { setEditName(node.name); setRenaming(true); }}
        onContextMenu={handleContextMenu}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => {
          setHovered(false);
          setDragOver(false);
          setDropHint(null);
        }}
        onMouseDown={handleMouseDown}
      >
        {isFolder && (
          <span className="tree-icon">{node.collapsed ? '▶' : '▼'}</span>
        )}
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
  const { collections, addCollection } = useCollectionStore();
  const [searchQuery, setSearchQuery] = useState('');

  const visibleCollections = useMemo(
    () => filterCollectionTree(collections, searchQuery),
    [collections, searchQuery],
  );

  const searching = searchQuery.trim().length > 0;

  return (
    <div className="sidebar">
      <section className="sidebar-section sidebar-section-collections">
        <div className="sidebar-section-header">
          <span>{t('collection.title')}</span>
          <div className="sidebar-section-actions">
            <button type="button" title={t('collection.addCollection')} onClick={() => addCollection()}>+</button>
          </div>
        </div>
        {collections.length > 0 && (
          <div className="sidebar-collection-search">
            <input
              type="search"
              className="sidebar-collection-search-input"
              placeholder={t('collection.searchPlaceholder')}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              spellCheck={false}
            />
          </div>
        )}
        <div className="sidebar-section-body">
          {collections.length === 0 && (
            <div className="sidebar-placeholder">{t('collection.empty')}</div>
          )}
          {collections.length > 0 && searching && visibleCollections.length === 0 && (
            <div className="sidebar-placeholder">{t('collection.searchNoResults')}</div>
          )}
          {visibleCollections.map((node) => (
            <TreeNode key={node.id} node={node} />
          ))}
        </div>
      </section>

    </div>
  );
}