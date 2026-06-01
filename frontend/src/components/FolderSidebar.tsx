import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { nanoid } from 'nanoid';
import {
  useFolderStore,
  getFolderPath,
  nodeInTree,
  areAllFoldersCollapsed,
  isFolderSubtreeFullyCollapsed,
} from '../store/useFolderStore';
import { useStore } from '../store/useStore';
import type { TreeFolder, TreeNode, TreeRequest } from '../types';
import { t } from '../i18n';
import { isImeComposing } from '../utils/keyboard';
import { methodColors } from '../constants';
import { useSettingsStore } from '../store/useSettings';
import TreeChevron from './TreeChevron';
import { dispatchFocusUrl } from '../utils/focusUrl';

// Global drag state shared across all TreeNodes
let dragSourceId: string | null = null;
let dragSourceIsFolder = false;
let dragGhostEl: HTMLElement | null = null;
let dragListenersAttached = false;
let dragDropTargetId: string | null = null;
let dragDropPosition: 'before' | 'after' | 'inside' | null = null;

const DRAG_HOVER_EVENT = 'folder-drag-hover';

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

function requestMatchesSearch(node: TreeRequest, queryNorm: string): boolean {
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
function withFoldersExpandedForSearch(nodes: TreeNode[]): TreeNode[] {
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
 * Filter tree: requests match by name/URL; folders match by name.
 * If a folder name matches, include its full subtree (all descendants).
 */
function filterFolderTree(nodes: TreeNode[], query: string): TreeNode[] {
  const q = query.trim();
  if (!q) return nodes;
  const qn = q.toLowerCase();

  const walk = (list: TreeNode[]): TreeNode[] => {
    const out: TreeNode[] = [];
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

function flattenVisibleNodes(nodes: TreeNode[]): TreeNode[] {
  const out: TreeNode[] = [];
  const walk = (list: TreeNode[]) => {
    for (const n of list) {
      out.push(n);
      if (n.type === 'folder' && !n.collapsed) {
        walk(n.children);
      }
    }
  };
  walk(nodes);
  return out;
}

function findNodeById(nodes: TreeNode[], id: string): TreeNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.type === 'folder') {
      const found = findNodeById(n.children, id);
      if (found) return found;
    }
  }
  return null;
}

function TreeNode({ node, depth = 0 }: { node: TreeNode; depth?: number }) {
  const {
    toggleCollapse, toggleFolderSubtreeCollapse, setActiveNode, activeNodeId,
    openContextMenu, closeContextMenu, contextMenu,
    addFolder, addRequest, renameNode, loadRequest,
    moveRequest, moveFolder, pendingRenameNodeId, consumePendingRename,
  } = useFolderStore();
  const { openTabFromFolder } = useStore();

  const isFolder = node.type === 'folder';
  const folderNode = isFolder ? (node as TreeFolder) : null;
  const hasDiskFile = !!folderNode?.fileName;
  const subtreeFullyCollapsed = folderNode ? isFolderSubtreeFullyCollapsed(folderNode) : false;
  const canDrag = !hasDiskFile;
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
        const path = getFolderPath(useFolderStore.getState().folders, node.id);
        openTabFromFolder(req, node.name, path, node.id);
      }
    }
  }, [isFolder, node.id, node.name, toggleCollapse, setActiveNode, loadRequest, openTabFromFolder]);

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
    if (isImeComposing(e)) return;
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
        data-folder-node-id={node.id}
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
        title={
          isFolder
            ? node.collapsed
              ? t('folder.expandHint')
              : t('folder.collapseHint')
            : undefined
        }
      >
        {isFolder && (
          <span className="tree-icon">
            <TreeChevron expanded={!node.collapsed} />
          </span>
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
            {isFolder && hasDiskFile && (
              <button
                type="button"
                className="tree-action-toggle-subtree"
                title={
                  subtreeFullyCollapsed
                    ? t('folder.expandAllSubtree')
                    : t('folder.collapseAllSubtree')
                }
                aria-pressed={!subtreeFullyCollapsed}
                onClick={e => {
                  e.stopPropagation();
                  toggleFolderSubtreeCollapse(node.id);
                }}
              >
                {subtreeFullyCollapsed ? '⊞' : '⊟'}
              </button>
            )}
            <button title={t('folder.addRequest')} onClick={e => {
              e.stopPropagation();
              const id = nanoid();
              addRequest(node.id, 'New Request', undefined, id);
              const req = useFolderStore.getState().loadRequest(id)!;
              const path = getFolderPath(useFolderStore.getState().folders, id);
              openTabFromFolder(req, 'New Request', path, id);
            }}>+R</button>
            {isFolder && <button title={t('folder.addFolder')} onClick={e => { e.stopPropagation(); addFolder(node.id); }}>+F</button>}
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
  const { closeContextMenu, deleteNode, cloneNode, addFolder, addRequest } = useFolderStore();
  const { openTabFromFolder } = useStore();
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
        left: useFolderStore.getState().contextMenu?.x ?? 0,
        top: useFolderStore.getState().contextMenu?.y ?? 0,
        zIndex: 1000,
      }}
      onContextMenu={e => e.preventDefault()}
    >
      <div className="context-menu-item" onClick={() => action(onStartRename)}>
        {t('folder.rename')}
      </div>
      <div className="context-menu-item" onClick={() => action(() => cloneNode(nodeId))}>
        {t('folder.duplicate')}
      </div>
      <div className="context-menu-item" onClick={() => action(() => deleteNode(nodeId))}>
        {t('folder.delete')}
      </div>
      {isFolder && (
        <>
          <div className="context-menu-separator" />
          <div className="context-menu-item" onClick={() => action(() => addFolder(nodeId))}>
            {t('folder.addFolder')}
          </div>
          <div className="context-menu-item" onClick={() => {
            const id = nanoid();
            closeContextMenu();
            addRequest(nodeId, 'New Request', undefined, id);
            const req = useFolderStore.getState().loadRequest(id)!;
            const path = getFolderPath(useFolderStore.getState().folders, id);
            openTabFromFolder(req, 'New Request', path, id);
          }}>
            {t('folder.addRequest')}
          </div>
        </>
      )}
    </div>
  );
}

export default function FolderSidebar() {
  const folderSidebarWidth = useSettingsStore((s) => s.folderSidebarWidth);
  const { folders, addFolder, toggleAllFoldersCollapse, activeNodeId, revealNode } = useFolderStore();
  const focusFolderSearch = useSettingsStore((s) => s.shortcuts.focusFolderSearch);
  const activeTabRequestNodeId = useStore(
    (s) => s.tabs.find((t) => t.id === s.activeTabId)?.requestNodeId ?? null,
  );
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    revealNode(activeTabRequestNodeId);
  }, [activeTabRequestNodeId, revealNode]);

  const visibleFolders = useMemo(
    () => filterFolderTree(folders, searchQuery),
    [folders, searchQuery],
  );

  const searching = searchQuery.trim().length > 0;
  const allFoldersCollapsed = useMemo(
    () => areAllFoldersCollapsed(folders),
    [folders],
  );

  const keyboardList = useMemo(() => flattenVisibleNodes(visibleFolders), [visibleFolders]);

  // Keyboard shortcuts: arrows navigate; left/right collapse/expand; Enter opens request.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isImeComposing(e as unknown as React.KeyboardEvent)) return;
      const key = e.key;

      const el = document.activeElement as HTMLElement | null;
      const tag = el?.tagName?.toLowerCase() ?? '';
      const isTypingTarget =
        tag === 'input' ||
        tag === 'textarea' ||
        el?.isContentEditable === true;
      const isSearchInput = el?.classList?.contains('sidebar-folder-search-input') ?? false;

      // When typing in other inputs, don't steal arrows/enter.
      if (isTypingTarget && !isSearchInput) return;

      const list = keyboardList;
      if (list.length === 0) return;

      const curId = useFolderStore.getState().activeNodeId;
      const curIdx = curId ? list.findIndex((n) => n.id === curId) : -1;

      const setActiveByIndex = (idx: number) => {
        const clamped = Math.max(0, Math.min(list.length - 1, idx));
        useFolderStore.getState().setActiveNode(list[clamped]!.id);
      };

      const move = (delta: number) => {
        if (curIdx === -1) setActiveByIndex(0);
        else setActiveByIndex(curIdx + delta);
      };

      if (key === 'ArrowDown') {
        e.preventDefault();
        move(1);
        return;
      }
      if (key === 'ArrowUp') {
        e.preventDefault();
        move(-1);
        return;
      }

      // In search mode: left/right also move within results.
      if (searching) {
        if (key === 'ArrowLeft') {
          e.preventDefault();
          move(-1);
          return;
        }
        if (key === 'ArrowRight') {
          e.preventDefault();
          move(1);
          return;
        }
      } else {
        // Tree mode: left collapses folder; right expands folder.
        if (key === 'ArrowLeft' || key === 'ArrowRight') {
          const id = useFolderStore.getState().activeNodeId;
          if (!id) return;
          const node = findNodeById(useFolderStore.getState().folders, id);
          if (!node || node.type !== 'folder') return;
          if (key === 'ArrowLeft' && !node.collapsed) {
            e.preventDefault();
            useFolderStore.getState().toggleCollapse(id);
            return;
          }
          if (key === 'ArrowRight' && node.collapsed) {
            e.preventDefault();
            useFolderStore.getState().toggleCollapse(id);
            return;
          }
        }
      }

      if (key === 'Enter') {
        const id = useFolderStore.getState().activeNodeId;
        if (!id) return;
        const node = findNodeById(useFolderStore.getState().folders, id);
        if (!node || node.type !== 'request') return;
        e.preventDefault();
        const req = useFolderStore.getState().loadRequest(id);
        if (!req) return;
        const path = getFolderPath(useFolderStore.getState().folders, id);
        useStore.getState().openTabFromFolder(req, node.name, path, id);
        // Move focus into request editor (URL bar) after opening.
        dispatchFocusUrl();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [keyboardList, searching]);

  /** Only clear search when switching tabs (or folders reload): if the new active node is hidden by the current filter. Never clear while the user is typing (that would use stale activeTabRequestNodeId with changing visibleFolders). */
  useEffect(() => {
    if (!activeTabRequestNodeId) return;
    setSearchQuery((q) => {
      const trimmed = q.trim();
      if (!trimmed) return q;
      const filtered = filterFolderTree(folders, q);
      if (!nodeInTree(filtered, activeTabRequestNodeId)) return '';
      return q;
    });
  }, [activeTabRequestNodeId, folders]);

  useEffect(() => {
    if (!activeNodeId) return;
    if (searching && !nodeInTree(visibleFolders, activeNodeId)) return;
    requestAnimationFrame(() => {
      document
        .querySelector(`[data-folder-node-id="${CSS.escape(activeNodeId)}"]`)
        ?.scrollIntoView({ block: 'nearest' });
    });
  }, [activeNodeId, searching, visibleFolders]);

  return (
    <aside
      className="sidebar"
      style={{ width: folderSidebarWidth, minWidth: folderSidebarWidth }}
    >
      <section className="sidebar-section sidebar-section-folders">
        <div className="sidebar-section-header">
          <span>{t('folder.title')}</span>
          <div className="sidebar-section-actions">
            {folders.length > 0 && (
              <button
                type="button"
                className="sidebar-toggle-all-folders"
                title={allFoldersCollapsed ? t('folder.expandAll') : t('folder.collapseAll')}
                aria-pressed={!allFoldersCollapsed}
                onClick={() => toggleAllFoldersCollapse()}
              >
                {allFoldersCollapsed ? '⊞' : '⊟'}
              </button>
            )}
            <button type="button" title={t('folder.addFolder')} onClick={() => addFolder(null)}>+</button>
          </div>
        </div>
        {folders.length > 0 && (
          <div className="sidebar-folder-search">
            <input
              type="search"
              className="sidebar-folder-search-input"
              placeholder={t('folder.searchPlaceholder')}
              title={`${t('folder.searchPlaceholder')} (${focusFolderSearch})`}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              spellCheck={false}
            />
          </div>
        )}
        <div className="sidebar-section-body">
          {folders.length === 0 && (
            <div className="sidebar-placeholder">{t('folder.empty')}</div>
          )}
          {folders.length > 0 && searching && visibleFolders.length === 0 && (
            <div className="sidebar-placeholder">{t('folder.searchNoResults')}</div>
          )}
          {visibleFolders.map((node) => (
            <TreeNode key={node.id} node={node} />
          ))}
        </div>
      </section>
    </aside>
  );
}