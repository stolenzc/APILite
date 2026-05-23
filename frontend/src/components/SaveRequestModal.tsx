import { useState, useCallback } from 'react';
import { useCollectionStore } from '../store/useCollection';
import type { CollectionFolder, CollectionNode } from '../types';
import { t } from '../i18n';
import { useModalOverlayDismiss } from '../utils/modalOverlayDismiss';

function folderChildren(nodes: CollectionNode[]): CollectionFolder[] {
  return nodes.filter((n) => n.type === 'folder') as CollectionFolder[];
}

function hasFolderChildren(folder: CollectionFolder): boolean {
  return folderChildren(folder.children).length > 0;
}

interface FolderTreeProps {
  nodes: CollectionNode[];
  depth: number;
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
  selectedFolderId: string | null;
  onSelectFolder: (id: string) => void;
  onSave: () => void;
}

function SaveFolderTree({
  nodes,
  depth,
  expandedIds,
  onToggleExpand,
  selectedFolderId,
  onSelectFolder,
  onSave,
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
                  {expanded ? '▾' : '▶'}
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
  const collections = useCollectionStore((s) => s.collections);
  const [name, setName] = useState(defaultName);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const overlayDismiss = useModalOverlayDismiss(onClose);

  const hasFolders = folderChildren(collections).length > 0;

  const onToggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

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

        <label className="save-request-field-label">{t('saveRequest.folder')}</label>
        <div className="save-request-browser" role="tree" aria-label={t('saveRequest.folder')}>
          {!hasFolders ? (
            <div className="save-request-browser-empty">
              <p>{t('saveRequest.noFolders')}</p>
              <p className="save-request-browser-hint">{t('saveRequest.createFolderHint')}</p>
            </div>
          ) : (
            <SaveFolderTree
              nodes={collections}
              depth={0}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
              selectedFolderId={selectedFolderId}
              onSelectFolder={setSelectedFolderId}
              onSave={handleSubmit}
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
            disabled={!hasFolders || !selectedFolderId}
          >
            {t('saveRequest.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
