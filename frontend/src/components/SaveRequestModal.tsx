import { useState, useCallback, useEffect, useRef } from 'react';
import { useFolderStore, folderPathIds } from '../store/useFolderStore';
import type { TreeFolder, TreeNode } from '../types';
import { t } from '../i18n';
import { useModalOverlayDismiss } from '../utils/modalOverlayDismiss';
import { showToast } from '../utils/toast';
import TreeChevron from './TreeChevron';

function folderChildren(nodes: TreeNode[]): TreeFolder[] {
  return nodes.filter((n) => n.type === 'folder') as TreeFolder[];
}

function findFolderById(nodes: TreeNode[], id: string): TreeFolder | null {
  for (const n of nodes) {
    if (n.type === 'folder') {
      if (n.id === id) return n;
      const found = findFolderById(n.children, id);
      if (found) return found;
    }
  }
  return null;
}

function hasFolderChildren(folder: TreeFolder): boolean {
  return folderChildren(folder.children).length > 0;
}

type SaveFolderContextMenuState = {
  folderId: string;
  x: number;
  y: number;
  empty: boolean;
};

function SaveFolderContextMenu({
  menu,
  onClose,
  onDelete,
}: {
  menu: SaveFolderContextMenuState;
  onClose: () => void;
  onDelete: (folderId: string) => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="context-menu save-request-context-menu"
      style={{ left: menu.x, top: menu.y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        className={`context-menu-item${menu.empty ? '' : ' context-menu-item--disabled'}`}
        title={!menu.empty ? t('saveRequest.deleteFolderNotEmpty') : undefined}
        onClick={() => {
          if (menu.empty) {
            onDelete(menu.folderId);
            onClose();
          }
        }}
      >
        {t('saveRequest.delete')}
      </div>
    </div>
  );
}

interface FolderTreeProps {
  nodes: TreeNode[];
  depth: number;
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
  selectedFolderId: string | null;
  onSelectFolder: (id: string) => void;
  onSave: () => void;
  onFolderContextMenu: (folder: TreeFolder, e: React.MouseEvent) => void;
}

function SaveFolderTree({
  nodes,
  depth,
  expandedIds,
  onToggleExpand,
  selectedFolderId,
  onSelectFolder,
  onSave,
  onFolderContextMenu,
}: FolderTreeProps) {
  const folders = folderChildren(nodes);
  if (folders.length === 0) return null;

  return (
    <>
      {folders.map((folder) => {
        const expandable = hasFolderChildren(folder);
        const expanded = expandedIds.has(folder.id);
        const selected = folder.id === selectedFolderId;

        return (
          <div key={folder.id} className="save-request-tree-branch" role="none">
            <div
              className={`save-request-tree-row-wrap${selected ? ' save-request-tree-row-wrap--selected' : ''}`}
              style={{ paddingLeft: 8 + depth * 18 }}
              role="treeitem"
              aria-expanded={expandable ? expanded : undefined}
              aria-selected={selected}
              onContextMenu={(e) => onFolderContextMenu(folder, e)}
            >
              {expandable ? (
                <button
                  type="button"
                  className="save-request-tree-expand"
                  aria-label={expanded ? t('saveRequest.collapse') : t('saveRequest.expand')}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleExpand(folder.id);
                  }}
                >
                  <TreeChevron expanded={expanded} />
                </button>
              ) : (
                <span className="save-request-tree-expand save-request-tree-expand--leaf" aria-hidden />
              )}
              <button
                type="button"
                className="save-request-tree-row"
                onClick={() => onSelectFolder(folder.id)}
                onDoubleClick={onSave}
              >
                <span className="save-request-tree-folder" aria-hidden>📁</span>
                <span className="save-request-tree-name">{folder.name}</span>
              </button>
            </div>
            {expandable && expanded && (
              <SaveFolderTree
                nodes={folder.children}
                depth={depth + 1}
                expandedIds={expandedIds}
                onToggleExpand={onToggleExpand}
                selectedFolderId={selectedFolderId}
                onSelectFolder={onSelectFolder}
                onSave={onSave}
                onFolderContextMenu={onFolderContextMenu}
              />
            )}
          </div>
        );
      })}
    </>
  );
}

interface Props {
  onClose: () => void;
  onSave: (folderId: string | null, name: string) => void;
  defaultName: string;
}

export default function SaveRequestModal({ onClose, onSave, defaultName }: Props) {
  const folders = useFolderStore((s) => s.folders);
  const addFolder = useFolderStore((s) => s.addFolder);
  const deleteNode = useFolderStore((s) => s.deleteNode);
  const [name, setName] = useState(defaultName);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [contextMenu, setContextMenu] = useState<SaveFolderContextMenuState | null>(null);
  const overlayDismiss = useModalOverlayDismiss(onClose);

  const rootFolders = folderChildren(folders);
  const hasFolders = rootFolders.length > 0;

  const expandToNode = useCallback((nodeId: string) => {
    const tree = useFolderStore.getState().folders;
    const pathIds = folderPathIds(tree, nodeId);
    setExpandedIds((prev) => new Set([...prev, ...pathIds]));
  }, []);

  const onToggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleNewRootFolder = useCallback(() => {
    const id = addFolder(null);
    if (!id) return;
    setSelectedFolderId(id);
    setExpandedIds((prev) => new Set(prev).add(id));
  }, [addFolder]);

  const handleNewSubfolder = useCallback(() => {
    if (!selectedFolderId) return;
    const newId = addFolder(selectedFolderId);
    if (!newId) return;
    expandToNode(newId);
    setSelectedFolderId(newId);
  }, [addFolder, selectedFolderId, expandToNode]);

  const handleCreate = useCallback(() => {
    if (selectedFolderId) handleNewSubfolder();
    else handleNewRootFolder();
  }, [selectedFolderId, handleNewSubfolder, handleNewRootFolder]);

  const clearSelection = useCallback(() => {
    setSelectedFolderId(null);
  }, []);

  const onFolderContextMenu = useCallback((folder: TreeFolder, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      folderId: folder.id,
      x: e.clientX,
      y: e.clientY,
      empty: folder.children.length === 0,
    });
  }, []);

  const handleDeleteFolder = useCallback(
    (folderId: string) => {
      const folder = findFolderById(useFolderStore.getState().folders, folderId);
      if (!folder || folder.children.length > 0) {
        showToast(t('saveRequest.deleteFolderNotEmpty'));
        return;
      }
      deleteNode(folderId);
      if (selectedFolderId === folderId) setSelectedFolderId(null);
      setExpandedIds((prev) => {
        const next = new Set(prev);
        next.delete(folderId);
        return next;
      });
    },
    [deleteNode, selectedFolderId],
  );

  const handleSubmit = () => {
    if (!selectedFolderId) return;
    onSave(selectedFolderId, name || 'Untitled');
    onClose();
  };

  return (
    <div className="modal-overlay save-request-modal-overlay" {...overlayDismiss}>
      <div className="modal modal--save-request" onClick={(e) => e.stopPropagation()}>
        <h3>{t('saveRequest.title')}</h3>

        <label className="save-request-field-label" htmlFor="save-request-name">
          {t('saveRequest.name')}
        </label>
        <input
          id="save-request-name"
          type="text"
          className="save-request-name-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit();
          }}
          autoFocus
        />

        <div className="save-request-folder-header">
          <label className="save-request-field-label save-request-field-label--inline">
            {t('saveRequest.folder')}
          </label>
          <div className="save-request-browser-toolbar">
            <button
              type="button"
              className="btn btn-secondary save-request-toolbar-btn"
              onClick={handleCreate}
            >
              {selectedFolderId ? t('saveRequest.newSubfolder') : t('saveRequest.newFolder')}
            </button>
          </div>
        </div>

        <div
          className="save-request-browser"
          role="tree"
          aria-label={t('saveRequest.folder')}
          onMouseDown={(e) => {
            const target = e.target as HTMLElement;
            if (!target.closest('.save-request-tree-row-wrap')) {
              clearSelection();
              setContextMenu(null);
            }
          }}
        >
          {!hasFolders ? (
            <div className="save-request-browser-empty">
              <p>{t('saveRequest.noFolders')}</p>
              <p className="save-request-browser-hint">{t('saveRequest.createFolderHint')}</p>
            </div>
          ) : (
            <SaveFolderTree
              nodes={folders}
              depth={0}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
              selectedFolderId={selectedFolderId}
              onSelectFolder={setSelectedFolderId}
              onSave={handleSubmit}
              onFolderContextMenu={onFolderContextMenu}
            />
          )}
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {t('url.cancel')}
          </button>
          <button
            type="button"
            className="btn btn-send"
            onClick={handleSubmit}
            disabled={!selectedFolderId}
          >
            {t('saveRequest.save')}
          </button>
        </div>
      </div>

      {contextMenu && (
        <SaveFolderContextMenu
          menu={contextMenu}
          onClose={() => setContextMenu(null)}
          onDelete={handleDeleteFolder}
        />
      )}
    </div>
  );
}
