import { useState, useEffect, useRef } from 'react';
import { useCollectionStore } from '../store/useCollection';
import type { CollectionFolder, CollectionNode } from '../types';
import { t } from '../i18n';
import { useModalOverlayDismiss } from '../utils/modalOverlayDismiss';

interface TreeNode {
  id: string;
  name: string;
  depth: number;
  isLast: boolean;
  prefixParts: { connector: string; padding: string }[];
}

function buildTree(nodes: CollectionNode[], depth = 0, parentPrefix: { connector: string; padding: string }[] = []): TreeNode[] {
  const result: TreeNode[] = [];
  const folders = nodes.filter(n => n.type === 'folder') as CollectionFolder[];
  folders.forEach((node, i) => {
    const isLast = i === folders.length - 1;
    const connector = isLast ? '└─ ' : '├─ ';
    const padding = isLast ? '   ' : '│  ';
    const prefixParts = depth === 0 ? [] : [...parentPrefix, { connector, padding }];
    result.push({ id: node.id, name: node.name, depth, isLast, prefixParts });
    result.push(...buildTree(node.children, depth + 1, prefixParts));
  });
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
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const overlayDismiss = useModalOverlayDismiss(onClose);
  const tree = buildTree(collections);

  useEffect(() => {
    if (tree.length > 0 && selectedFolderId === null) {
      setSelectedFolderId(tree[0].id);
    }
  }, [tree, selectedFolderId]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const selectedNode = tree.find(n => n.id === selectedFolderId);

  const handleSubmit = () => {
    onSave(selectedFolderId, name || 'Untitled');
    onClose();
  };

  return (
    <div className="modal-overlay" {...overlayDismiss}>
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
          <div ref={dropdownRef} style={{ position: 'relative' }}>
            <div
              onClick={() => setDropdownOpen(!dropdownOpen)}
              style={{
                width: '100%',
                background: 'var(--bg-input)',
                color: selectedNode ? 'var(--text-primary)' : 'var(--text-muted)',
                border: '1px solid var(--border-color)',
                borderRadius: 4,
                padding: '8px 10px',
                fontSize: 13,
                fontFamily: 'var(--font-mono)',
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              {selectedNode ? (
                <span>
                  {selectedNode.prefixParts.map((p, i) => (
                    <span key={i} style={{ color: 'var(--text-muted)' }}>{p.connector}</span>
                  ))}
                  {selectedNode.name}
                </span>
              ) : t('saveRequest.noFolders')}
            </div>
            {dropdownOpen && tree.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: 2,
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: 4,
                maxHeight: 240,
                overflowY: 'auto',
                zIndex: 100,
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              }}>
                {tree.map(node => (
                  <div
                    key={node.id}
                    onClick={() => {
                      setSelectedFolderId(node.id);
                      setDropdownOpen(false);
                    }}
                    style={{
                      padding: '6px 10px',
                      fontSize: 13,
                      fontFamily: 'var(--font-mono)',
                      cursor: 'pointer',
                      background: node.id === selectedFolderId ? 'var(--bg-tertiary)' : 'transparent',
                      color: node.id === selectedFolderId ? 'var(--accent)' : 'var(--text-primary)',
                      whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={e => { if (node.id !== selectedFolderId) (e.currentTarget as HTMLElement).style.background = 'var(--bg-input)'; }}
                    onMouseLeave={e => { if (node.id !== selectedFolderId) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    {node.prefixParts.map((p, i) => (
                      <span key={i} style={{ color: 'var(--text-muted)' }}>{p.connector}</span>
                    ))}
                    {node.name}
                  </div>
                ))}
              </div>
            )}
          </div>
          {tree.length === 0 && (
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              {t('saveRequest.createFolderHint')}
            </p>
          )}
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>{t('url.cancel')}</button>
          <button className="btn btn-send" onClick={handleSubmit} disabled={tree.length === 0}>{t('saveRequest.save')}</button>
        </div>
      </div>
    </div>
  );
}
