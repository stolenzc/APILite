import { useState, useRef, useEffect, useCallback } from 'react';
import { useCollectionStore } from '../store/useCollection';
import { useStore } from '../store/useStore';
import type { CollectionNode } from '../types';
import { t } from '../i18n';
import { methodColors } from '../constants';

function TreeNode({ node, depth = 0 }: { node: CollectionNode; depth?: number }) {
  const {
    toggleCollapse, setActiveNode, activeNodeId,
    openContextMenu, closeContextMenu, contextMenu,
    deleteNode, cloneNode, addFolder, addRequest, renameNode, loadRequest,
  } = useCollectionStore();
  const { loadRequest: loadRequestIntoStore } = useStore();

  const isFolder = node.type === 'folder';
  const isActive = activeNodeId === node.id;
  const [renaming, setRenaming] = useState(false);
  const [editName, setEditName] = useState(node.name);
  const [hovered, setHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
        loadRequestIntoStore(req);
      }
    }
  }, [isFolder, node.id, toggleCollapse, setActiveNode, loadRequest, loadRequestIntoStore]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    openContextMenu(node.id, e.clientX, e.clientY);
  }, [node.id, openContextMenu]);

  const confirmRename = useCallback(() => {
    if (editName.trim()) {
      renameNode(node.id, editName.trim());
    }
    setRenaming(false);
  }, [editName, node.id, renameNode]);

  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') confirmRename();
    if (e.key === 'Escape') { setEditName(node.name); setRenaming(false); }
  }, [confirmRename, node.name]);

  const ctxOpen = contextMenu?.nodeId === node.id;

  return (
    <div>
      <div
        className={`tree-node ${isActive ? 'active' : ''}`}
        style={{ paddingLeft: depth * 16 + 8 }}
        onClick={handleClick}
        onDoubleClick={() => { setEditName(node.name); setRenaming(true); }}
        onContextMenu={handleContextMenu}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
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
            <button title={t('collection.addRequest')} onClick={e => { e.stopPropagation(); addRequest(node.id); }}>+R</button>
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
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = () => closeContextMenu();
    const timer = setTimeout(() => document.addEventListener('mousedown', handler));
    return () => { clearTimeout(timer); document.removeEventListener('mousedown', handler); };
  }, [closeContextMenu]);

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
          <div className="context-menu-item" onClick={() => action(() => addRequest(nodeId))}>
            {t('collection.addRequest')}
          </div>
        </>
      )}
    </div>
  );
}

export default function CollectionSidebar() {
  const { collections, addFolder, addRequest } = useCollectionStore();

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <span>{t('collection.title')}</span>
        <div className="sidebar-actions">
          <button title={t('collection.addFolder')} onClick={() => addFolder(null)}>+F</button>
          <button title={t('collection.addRequest')} onClick={() => addRequest(null)}>+R</button>
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
