import { create } from 'zustand';
import { nanoid } from 'nanoid';
import { invoke } from '@tauri-apps/api/core';
import type { CollectionNode, CollectionFolder, CollectionRequest, HttpRequest } from '../types';
import { cloneHttpRequest, normalizeHttpRequest } from '../utils/normalizeRequest';
import { getCollectionsDir } from '../utils/storagePaths';
import { showToast } from '../utils/toast';
import { t } from '../i18n';
import { useStore } from './useStore';
import {
  normalizeCollectionTree,
  normalizeFolderChildren,
  nextRequestSortOrder,
} from '../utils/collectionSort';

const defaultRequest: HttpRequest = normalizeHttpRequest({ method: 'GET', url: '' });

function collectionsDir(): string {
  return getCollectionsDir();
}

function isCollectionRoot(node: CollectionNode): boolean {
  return node.type === 'folder' && !!node.fileName;
}

function asCollectionRoot(node: CollectionNode): CollectionFolder | null {
  if (node.type === 'folder' && node.fileName) return node;
  return null;
}

function collectionNameTaken(collections: CollectionNode[], name: string, exceptId?: string): boolean {
  const norm = name.trim().toLowerCase();
  if (!norm) return false;
  return collections.some(
    n => isCollectionRoot(n) && n.id !== exceptId && n.name.trim().toLowerCase() === norm,
  );
}

function collectionFilePayload(root: CollectionFolder): string {
  return JSON.stringify({
    id: root.id,
    name: root.name,
    collapsed: root.collapsed,
    children: root.children,
  });
}

function findNode(
  nodes: CollectionNode[],
  id: string,
): { node: CollectionNode | null; parent: CollectionFolder | null; path: CollectionNode[] } {
  for (const node of nodes) {
    if (node.id === id) return { node, parent: null, path: [node] };
    if (node.type === 'folder') {
      const result = findNode(node.children, id);
      if (result.node) return { node: result.node, parent: node, path: [node, ...result.path] };
    }
  }
  return { node: null, parent: null, path: [] };
}

function findCollectionRoot(nodes: CollectionNode[], nodeId: string): CollectionFolder | null {
  for (const node of nodes) {
    if (node.type === 'folder' && node.fileName) {
      if (node.id === nodeId) return node;
      if (findNode(node.children, nodeId).node) return node;
    }
  }
  return null;
}

async function persistCollectionRoot(root: CollectionFolder) {
  const dir = collectionsDir();
  if (!dir || !root.fileName) return;
  await invoke('collections_save', {
    dir,
    fileName: root.fileName,
    data: collectionFilePayload(root),
  });
}

async function persistForNodeId(nodeId: string, collections: CollectionNode[]) {
  const root = findCollectionRoot(collections, nodeId);
  if (root) await persistCollectionRoot(root);
}

function defaultParentId(collections: CollectionNode[], activeNodeId: string | null): string | null {
  if (activeNodeId) {
    const { node } = findNode(collections, activeNodeId);
    if (node?.type === 'folder') return node.id;
    const root = findCollectionRoot(collections, activeNodeId);
    if (root) return root.id;
  }
  const first = collections.find((n): n is CollectionFolder => isCollectionRoot(n));
  return first?.id ?? null;
}

export function getCollectionPath(nodes: CollectionNode[], id: string): string {
  const { path } = findNode(nodes, id);
  return path.map(n => n.name).join(' > ');
}

export function nodeInTree(nodes: CollectionNode[], id: string): boolean {
  for (const n of nodes) {
    if (n.id === id) return true;
    if (n.type === 'folder' && nodeInTree(n.children, id)) return true;
  }
  return false;
}

/** Folder ids from collection root down to `nodeId` (inclusive), for expanding tree UIs. */
export function folderPathIds(nodes: CollectionNode[], nodeId: string): string[] {
  const { path } = findNode(nodes, nodeId);
  return path.filter((n): n is CollectionFolder => n.type === 'folder').map((n) => n.id);
}

function expandPathToNode(collections: CollectionNode[], nodeId: string): CollectionNode[] {
  const { node, path } = findNode(collections, nodeId);
  if (!node) return collections;
  const expandIds = new Set(
    path.filter((n): n is CollectionFolder => n.type === 'folder').map((n) => n.id),
  );

  const mapNodes = (nodes: CollectionNode[]): { nodes: CollectionNode[]; changed: boolean } => {
    let changed = false;
    const mapped = nodes.map((n) => {
      if (n.type !== 'folder') return n;
      const { nodes: children, changed: childChanged } = mapNodes(n.children);
      const needExpand = expandIds.has(n.id) && n.collapsed;
      if (!needExpand && !childChanged) return n;
      changed = true;
      const folder = needExpand ? { ...n, collapsed: false } : n;
      return childChanged ? { ...folder, children } : folder;
    });
    return { nodes: changed ? mapped : nodes, changed };
  };

  const { nodes, changed } = mapNodes(collections);
  return changed ? nodes : collections;
}

function removeNode(nodes: CollectionNode[], id: string): CollectionNode[] {
  return nodes
    .filter(n => n.id !== id)
    .map(n => (n.type === 'folder' ? { ...n, children: removeNode(n.children, id) } : n));
}

function updateNode(nodes: CollectionNode[], id: string, update: Partial<CollectionNode>): CollectionNode[] {
  return nodes.map(n => {
    if (n.id === id) return { ...n, ...update } as CollectionNode;
    if (n.type === 'folder') return { ...n, children: updateNode(n.children, id, update) };
    return n;
  });
}

/** Set collapsed on folder and every nested folder (persisted state for subtree). */
function collapseFolderAndDescendants(folder: CollectionFolder): CollectionFolder {
  return {
    ...folder,
    collapsed: true,
    children: folder.children.map((c) =>
      c.type === 'folder' ? collapseFolderAndDescendants(c) : c,
    ),
  };
}

function collapseSubtreeInTree(nodes: CollectionNode[], folderId: string): CollectionNode[] {
  return nodes.map((n) => {
    if (n.type !== 'folder') return n;
    if (n.id === folderId) return collapseFolderAndDescendants(n);
    return { ...n, children: collapseSubtreeInTree(n.children, folderId) };
  });
}

function expandFolderInTree(nodes: CollectionNode[], folderId: string): CollectionNode[] {
  return nodes.map((n) => {
    if (n.type !== 'folder') return n;
    if (n.id === folderId) return { ...n, collapsed: false };
    return { ...n, children: expandFolderInTree(n.children, folderId) };
  });
}

function duplicateNode(node: CollectionNode): CollectionNode {
  if (node.type === 'folder') {
    const copy: CollectionFolder = {
      ...node,
      id: nanoid(),
      fileName: undefined,
      children: node.children.map(duplicateNode),
    };
    return copy;
  }
  return {
    ...node,
    id: nanoid(),
    request: { ...node.request, params: [...node.request.params], headers: [...node.request.headers] },
  };
}

/** True if `targetId` is the folder or any node inside it. */
function folderContainsId(nodes: CollectionNode[], folderId: string, targetId: string): boolean {
  if (folderId === targetId) return true;
  const { node } = findNode(nodes, folderId);
  if (!node || node.type !== 'folder') return false;
  return findNode(node.children, targetId).node !== null;
}

function findParentFolder(nodes: CollectionNode[], childId: string): CollectionFolder | null {
  for (const node of nodes) {
    if (node.type !== 'folder') continue;
    if (node.children.some((c) => c.id === childId)) return node;
    const nested = findParentFolder(node.children, childId);
    if (nested) return nested;
  }
  return null;
}

interface CollectionStore {
  collections: CollectionNode[];
  activeNodeId: string | null;
  contextMenu: { nodeId: string; x: number; y: number } | null;
  pendingRenameNodeId: string | null;

  initCollections: (dir: string) => Promise<void>;
  addCollection: (name?: string) => string | false;
  addFolder: (parentId: string | null) => string | undefined;
  addRequest: (parentId: string | null, name?: string, request?: HttpRequest, id?: string) => string | undefined;
  consumePendingRename: () => void;
  getRequestNode: (id: string) => CollectionRequest | null;
  renameNode: (id: string, name: string) => boolean;
  updateRequest: (id: string, name: string, request: HttpRequest) => void;
  deleteNode: (id: string) => void;
  toggleCollapse: (id: string) => void;
  cloneNode: (id: string) => void;
  setActiveNode: (id: string | null) => void;
  /** Expand ancestors and highlight a collection tree node (e.g. when switching tabs). */
  revealNode: (id: string | null) => void;
  loadRequest: (id: string) => HttpRequest | null;
  openContextMenu: (nodeId: string, x: number, y: number) => void;
  closeContextMenu: () => void;
  moveRequest: (
    sourceId: string,
    targetId: string,
    position: 'before' | 'after' | 'inside',
  ) => void;
  moveFolder: (sourceId: string, targetFolderId: string) => void;
}

export const useCollectionStore = create<CollectionStore>((set, get) => ({
  collections: [],
  activeNodeId: null,
  contextMenu: null,
  pendingRenameNodeId: null,

  consumePendingRename: () => set({ pendingRenameNodeId: null }),

  initCollections: async (dir: string) => {
    if (!dir) {
      set({ collections: [] });
      return;
    }
    try {
      const data: string = await invoke('load_collections', { dir });
      set({ collections: normalizeCollectionTree(JSON.parse(data)) });
    } catch (err) {
      console.error('Failed to load collections:', err);
      set({ collections: [] });
    }
  },

  addCollection: (name = 'New Collection') => {
    const trimmed = name.trim() || 'New Collection';
    if (collectionNameTaken(get().collections, trimmed)) {
      showToast(t('collection.duplicateName'));
      return false;
    }
    const id = nanoid();
    const root: CollectionFolder = {
      id,
      name: trimmed,
      type: 'folder',
      children: [],
      collapsed: false,
      fileName: '',
    };
    set(state => ({
      collections: [...state.collections, root],
      pendingRenameNodeId: id,
      activeNodeId: id,
    }));
    const dir = collectionsDir();
    if (!dir) return id;
    void invoke<string>('collections_create', { dir, id, name: trimmed })
      .then(fileName => {
        set(state => ({
          collections: updateNode(state.collections, id, { fileName } as Partial<CollectionFolder>),
        }));
      })
      .catch(err => {
        console.error('Failed to create collection:', err);
        set(state => ({ collections: removeNode(state.collections, id) }));
        if (String(err).includes('duplicate_collection_name')) {
          showToast(t('collection.duplicateName'));
        }
      });
    return id;
  },

  addFolder: (parentId) => {
    const collections = [...get().collections];
    const parentKey = parentId ?? defaultParentId(collections, get().activeNodeId);
    if (!parentKey) return undefined;

    const folder: CollectionFolder = {
      id: nanoid(),
      name: 'New Folder',
      type: 'folder',
      children: [],
      collapsed: false,
    };
    const parent = findNode(collections, parentKey).node;
    if (parent?.type !== 'folder') return undefined;
    parent.collapsed = false;
    parent.children = normalizeFolderChildren([...parent.children, folder]);
    set({
      collections,
      pendingRenameNodeId: folder.id,
      activeNodeId: folder.id,
    });
    void persistForNodeId(parentKey, collections).catch(err =>
      console.error('Failed to save folder:', err),
    );
    return folder.id;
  },

  addRequest: (parentId, name = 'New Request', request = { ...defaultRequest }, id?: string) => {
    const collections = [...get().collections];
    const parentKey = parentId ?? defaultParentId(collections, get().activeNodeId);
    if (!parentKey) return undefined;

    const parent = findNode(collections, parentKey).node;
    if (parent?.type !== 'folder') return undefined;
    const node: CollectionRequest = {
      id: id ?? nanoid(),
      name,
      type: 'request',
      request: { ...request, params: [...request.params], headers: [...request.headers] },
      sortOrder: nextRequestSortOrder(parent.children),
    };
    parent.collapsed = false;
    parent.children = normalizeFolderChildren([...parent.children, node]);
    set({
      collections,
      pendingRenameNodeId: node.id,
      activeNodeId: node.id,
    });
    void persistForNodeId(parentKey, collections).catch(err =>
      console.error('Failed to save request:', err),
    );
    return node.id;
  },

  getRequestNode: (id) => {
    const { node } = findNode(get().collections, id);
    return node?.type === 'request' ? node : null;
  },

  renameNode: (id, name) => {
    const trimmed = name.trim();
    if (!trimmed) return false;
    const { node } = findNode(get().collections, id);
    if (!node) return false;

    const collectionRoot = asCollectionRoot(node);
    if (collectionRoot && collectionNameTaken(get().collections, trimmed, id)) {
      showToast(t('collection.duplicateName'));
      return false;
    }

    let collections = updateNode([...get().collections], id, { name: trimmed });
    if (node.type === 'folder' && !isCollectionRoot(node)) {
      const parent = findParentFolder(collections, id);
      if (parent) {
        parent.children = normalizeFolderChildren(parent.children);
      }
    }
    set({ collections });

    if (node.type === 'request') {
      useStore.getState().syncCollectionTabName(id, trimmed);
    }

    if (collectionRoot?.fileName) {
      const dir = collectionsDir();
      if (!dir) return true;
      void invoke<string>('collections_rename', { dir, fileName: collectionRoot.fileName, newName: trimmed })
        .then(fileName => {
          set(state => ({
            collections: updateNode(state.collections, id, { fileName, name: trimmed } as Partial<CollectionFolder>),
          }));
          void persistForNodeId(id, get().collections);
        })
        .catch(err => {
          console.error('Failed to rename collection file:', err);
          if (String(err).includes('duplicate_collection_name')) {
            showToast(t('collection.duplicateName'));
          }
        });
    } else {
      void persistForNodeId(id, collections).catch(err =>
        console.error('Failed to save rename:', err),
      );
    }
    return true;
  },

  updateRequest: (id, name, request) => {
    const collections = updateNode([...get().collections], id, {
      name,
      request: cloneHttpRequest(request),
    });
    set({ collections });
    void persistForNodeId(id, collections).catch(err =>
      console.error('Failed to update request:', err),
    );
  },

  deleteNode: (id) => {
    const { node } = findNode(get().collections, id);
    const root = findCollectionRoot(get().collections, id);
    const collections = removeNode([...get().collections], id);
    set({
      collections,
      activeNodeId: get().activeNodeId === id ? null : get().activeNodeId,
    });
    const dir = collectionsDir();
    if (!dir || !node) return;

    const collectionRoot = asCollectionRoot(node);
    if (collectionRoot?.fileName) {
      void invoke('collections_delete', { dir, fileName: collectionRoot.fileName }).catch(err =>
        console.error('Failed to delete collection file:', err),
      );
    } else if (root) {
      const updated = findNode(collections, root.id).node as CollectionFolder | null;
      if (updated?.type === 'folder') {
        void persistCollectionRoot(updated).catch(err =>
          console.error('Failed to save after delete:', err),
        );
      }
    }
  },

  toggleCollapse: (id) => {
    const { node } = findNode(get().collections, id);
    if (!node || node.type !== 'folder') return;
    const collections = node.collapsed
      ? expandFolderInTree([...get().collections], id)
      : collapseSubtreeInTree([...get().collections], id);
    set({ collections });
    void persistForNodeId(id, collections).catch(err =>
      console.error('Failed to save collapse state:', err),
    );
  },

  cloneNode: (id) => {
    const { node, parent } = findNode(get().collections, id);
    if (!node) return;
    const cloned = duplicateNode(node);
    const collections = [...get().collections];
    let persistId: string;

    if (parent) {
      if (node.type === 'request' && cloned.type === 'request') {
        const requests = parent.children.filter((c): c is CollectionRequest => c.type === 'request');
        const idx = requests.findIndex((r) => r.id === id);
        requests.splice(idx + 1, 0, cloned as CollectionRequest);
        parent.children = normalizeFolderChildren([
          ...parent.children.filter((c) => c.type === 'folder'),
          ...requests,
        ]);
      } else {
        const idx = parent.children.findIndex((c) => c.id === id);
        parent.children.splice(idx + 1, 0, cloned);
        if (cloned.type === 'folder') {
          parent.children = normalizeFolderChildren(parent.children);
        }
      }
      persistId = parent.id;
    } else {
      if (cloned.type === 'folder' && asCollectionRoot(node)) {
        if (collectionNameTaken(collections, cloned.name)) {
          showToast(t('collection.duplicateName'));
          return;
        }
      }
      const idx = collections.findIndex(c => c.id === id);
      collections.splice(idx + 1, 0, cloned);
      persistId = asCollectionRoot(node)?.id ?? cloned.id;
      if (cloned.type === 'folder' && asCollectionRoot(node)) {
        const dir = collectionsDir();
        if (dir) {
          void invoke<string>('collections_create', { dir, id: cloned.id, name: cloned.name })
            .then(fileName => {
              set(state => ({
                collections: updateNode(state.collections, cloned.id, { fileName } as Partial<CollectionFolder>),
              }));
            });
        }
      }
    }
    set({ collections });
    void persistForNodeId(persistId, collections).catch(err =>
      console.error('Failed to clone:', err),
    );
  },

  setActiveNode: (activeNodeId) => set({ activeNodeId }),

  revealNode: (nodeId) =>
    set((state) => {
      if (!nodeId) {
        return state.activeNodeId === null ? state : { activeNodeId: null };
      }
      const { node } = findNode(state.collections, nodeId);
      if (!node) {
        return state.activeNodeId === null ? state : { activeNodeId: null };
      }
      const collections = expandPathToNode(state.collections, nodeId);
      if (state.activeNodeId === nodeId && collections === state.collections) {
        return state;
      }
      return { activeNodeId: nodeId, collections };
    }),

  loadRequest: (id) => {
    const { node } = findNode(get().collections, id);
    if (node && node.type === 'request') return node.request;
    return null;
  },

  openContextMenu: (nodeId, x, y) => set({ contextMenu: { nodeId, x, y } }),
  closeContextMenu: () => set({ contextMenu: null }),

  moveRequest: (sourceId, targetId, position) => {
    const state = get();
    const { node: source } = findNode(state.collections, sourceId);
    if (!source || source.type !== 'request' || sourceId === targetId) return;

    const sourceRoot = findCollectionRoot(state.collections, sourceId);
    const sourceSnapshot: CollectionRequest = {
      ...source,
      request: {
        ...source.request,
        params: source.request.params.map((p) => ({ ...p })),
        headers: source.request.headers.map((h) => ({ ...h })),
      },
    };

    let collections = removeNode([...state.collections], sourceId);

    if (position === 'inside') {
      const target = findNode(collections, targetId).node;
      if (!target || target.type !== 'folder') return;
      target.children = normalizeFolderChildren([
        ...target.children,
        { ...sourceSnapshot, sortOrder: nextRequestSortOrder(target.children) },
      ]);
    } else {
      const target = findNode(collections, targetId).node;
      if (!target || target.type !== 'request') return;
      const parent = findParentFolder(collections, targetId);
      if (!parent) return;

      const folders = parent.children.filter((c): c is CollectionFolder => c.type === 'folder');
      const requests = parent.children.filter((c): c is CollectionRequest => c.type === 'request');
      const targetIdx = requests.findIndex((r) => r.id === targetId);
      if (targetIdx === -1) return;
      const insertIdx = position === 'before' ? targetIdx : targetIdx + 1;
      requests.splice(insertIdx, 0, sourceSnapshot);
      parent.children = normalizeFolderChildren([...folders, ...requests]);
    }

    set({ collections });

    if (sourceRoot) {
      const updatedRoot = findNode(collections, sourceRoot.id).node;
      if (updatedRoot?.type === 'folder') {
        void persistCollectionRoot(updatedRoot).catch((err) =>
          console.error('Failed to save collection after move:', err),
        );
      }
    }
  },

  moveFolder: (sourceId, targetFolderId) => {
    if (sourceId === targetFolderId) return;
    const state = get();
    const { node: source } = findNode(state.collections, sourceId);
    if (!source || source.type !== 'folder' || isCollectionRoot(source)) return;

    const target = findNode(state.collections, targetFolderId).node;
    if (!target || target.type !== 'folder') return;
    if (folderContainsId(state.collections, sourceId, targetFolderId)) return;

    const sourceRoot = findCollectionRoot(state.collections, sourceId);

    let collections = removeNode([...state.collections], sourceId);
    const targetLive = findNode(collections, targetFolderId).node;
    if (!targetLive || targetLive.type !== 'folder') return;

    targetLive.collapsed = false;
    targetLive.children = normalizeFolderChildren([...targetLive.children, source]);
    set({ collections });

    if (sourceRoot) {
      const updatedRoot = findNode(collections, sourceRoot.id).node;
      if (updatedRoot?.type === 'folder') {
        void persistCollectionRoot(updatedRoot).catch((err) =>
          console.error('Failed to save collection after folder move:', err),
        );
      }
    }
  },
}));
