import { useState, useEffect } from 'react';
import { useCollectionStore } from '../store/useCollection';
import type { CollectionFolder, CollectionNode } from '../types';
import { t } from '../i18n';

function flattenFolders(nodes: CollectionNode[], depth = 0): { id: string; label: string }[] {
  const result: { id: string; label: string }[] = [];
  for (const node of nodes) {
    if (node.type === 'folder') {
      result.push({ id: node.id, label: '  '.repeat(depth) + node.name });
      result.push(...flattenFolders(node.children, depth + 1));
    }
  }
  return result;
}

interface Props {
  onClose: () => void;
  onSave: (folderId: string | null, name: string) => void;
  defaultName: string;
}

export default function SaveRequestModal({ onClose, onSave, defaultName }: Props) {
  const collections = useCollectionStore(s => s.collections);
  const [name, setName] = useState(defaultName);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const folders = flattenFolders(collections);

  // Pre-select first folder if available
  useEffect(() => {
    if (folders.length > 0 && selectedFolderId === null) {
      setSelectedFolderId(folders[0].id);
    }
  }, [folders, selectedFolderId]);

  const handleSubmit = () => {
    onSave(selectedFolderId, name || 'Untitled');
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ minWidth: 400 }}>
        <h3>{t('saveRequest.title')}</h3>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>
            {t('saveRequest.name')}
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
            autoFocus
            style={{
              width: '100%',
              background: 'var(--bg-input)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: 4,
              padding: '8px 10px',
              fontSize: 13,
              outline: 'none',
            }}
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>
            {t('saveRequest.folder')}
          </label>
          <select
            value={selectedFolderId ?? ''}
            onChange={e => setSelectedFolderId(e.target.value || null)}
            style={{
              width: '100%',
              background: 'var(--bg-input)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: 4,
              padding: '8px 10px',
              fontSize: 13,
            }}
          >
            {folders.length === 0 && (
              <option value="">{t('saveRequest.noFolders')}</option>
            )}
            {folders.map(f => (
              <option key={f.id} value={f.id}>{f.label}</option>
            ))}
          </select>
          {folders.length === 0 && (
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              {t('saveRequest.createFolderHint')}
            </p>
          )}
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>{t('url.cancel')}</button>
          <button className="btn btn-send" onClick={handleSubmit} disabled={folders.length === 0}>{t('saveRequest.save')}</button>
        </div>
      </div>
    </div>
  );
}
