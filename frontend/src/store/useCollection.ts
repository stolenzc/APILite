import { create } from 'zustand';
import { nanoid } from 'nanoid';
import { invoke } from '@tauri-apps/api/core';
import type { CollectionNode, CollectionFolder, CollectionRequest, HttpRequest } from '../types';
import { useSettingsStore } from './useSettings';
import { showToast } from '../utils/toast';
import { t } from '../i18n';

const defaultRequest: HttpRequest = {
  method: 'GET',
  url: '',
  params: [],
  headers: [],
  bodyType: 'none',
  rawContentType: 'json',
  body: '',
};

function collectionDir(): string {
  return useSettingsStore.getState().collectionDir;
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
  const dir = collectionDir();
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

function getAncestorIds(nodes: CollectionNode[], targetId: string, ancestors: string[] = []): string[] {
  for (const node of nodes) {
    if (node.id === targetId) return ancestors;
    if (node.type === 'folder') {
      const result = getAncestorIds(node.children, targetId, [...ancestors, node.id]);
      if (result.length > 0) return result;
    }
  }
  return [];
}

interface CollectionStore {
  collections: CollectionNode[];
  activeNodeId: string | null;
  contextMenu: { nodeId: string; x: number; y: number } | null;

  initCollections: (dir: string) => Promise<void>;
  addCollection: (name?: string) => boolean;
  addFolder: (parentId: string | null) => void;
  addRequest: (parentId: string | null, name?: string, request?: HttpRequest, id?: string) => void;
  renameNode: (id: string, name: string) => boolean;
  updateRequest: (id: string, name: string, request: HttpRequest) => void;
  deleteNode: (id: string) => void;
  toggleCollapse: (id: string) => void;
  cloneNode: (id: string) => void;
  setActiveNode: (id: string | null) => void;
  loadRequest: (id: string) => HttpRequest | null;
  openContextMenu: (nodeId: string, x: number, y: number) => void;
  closeContextMenu: () => void;
  moveNode: (sourceId: string, targetFolderId: string) => void;
  moveToRoot: (sourceId: string) => void;
}

export const useCollectionStore = create<CollectionStore>((set, get) => ({
  collections: [],
  activeNodeId: null,
  contextMenu: null,

  initCollections: async (dir: string) => {
    if (!dir) {
      set({ collections: [] });
      return;
    }
    try {
      const data: string = await invoke('load_collections', { dir });
      set({ collections: JSON.parse(data) });
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
    set(state => ({ collections: [...state.collections, root] }));
    const dir = collectionDir();
    if (!dir) return true;
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
    return true;
  },

  addFolder: (parentId) => {
    const collections = [...get().collections];
    const parentKey = parentId ?? defaultParentId(collections, get().activeNodeId);
    if (!parentKey) return;

    const folder: CollectionFolder = {
      id: nanoid(),
      name: 'New Folder',
      type: 'folder',
      children: [],
      collapsed: false,
    };
    const parent = findNode(collections, parentKey).node;
    if (parent?.type !== 'folder') return;
    parent.children = [...parent.children, folder];
    set({ collections });
    void persistForNodeId(parentKey, collections).catch(err =>
      console.error('Failed to save folder:', err),
    );
  },

  addRequest: (parentId, name = 'New Request', request = { ...defaultRequest }, id?: string) => {
    const collections = [...get().collections];
    const parentKey = parentId ?? defaultParentId(collections, get().activeNodeId);
    if (!parentKey) return;

    const node: CollectionRequest = {
      id: id ?? nanoid(),
      name,
      type: 'request',
      request: { ...request, params: [...request.params], headers: [...request.headers] },
    };
    const parent = findNode(collections, parentKey).node;
    if (parent?.type !== 'folder') return;
    parent.children = [...parent.children, node];
    set({ collections });
    void persistForNodeId(parentKey, collections).catch(err =>
      console.error('Failed to save request:', err),
    );
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

    const collections = updateNode([...get().collections], id, { name: trimmed });
    set({ collections });

    if (collectionRoot?.fileName) {
      const dir = collectionDir();
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
      request: {
        method: request.method,
        url: request.url,
        params: request.params.map(p => ({ ...p })),
        headers: request.headers.map(h => ({ ...h })),
        bodyType: request.bodyType,
        rawContentType: request.rawContentType,
        body: request.body,
      },
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
    const dir = collectionDir();
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
    const collections = updateNode([...get().collections], id, { collapsed: !node.collapsed });
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
      const idx = parent.children.findIndex(c => c.id === id);
      parent.children.splice(idx + 1, 0, cloned);
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
        const dir = collectionDir();
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

  loadRequest: (id) => {
    const { node } = findNode(get().collections, id);
    if (node && node.type === 'request') return node.request;
    return null;
  },

  openContextMenu: (nodeId, x, y) => set({ contextMenu: { nodeId, x, y } }),
  closeContextMenu: () => set({ contextMenu: null }),

  moveNode: (sourceId, targetFolderId) => {
    const state = get();
    const { node } = findNode(state.collections, sourceId);
    if (!node || sourceId === targetFolderId) return;
    if (isCollectionRoot(node)) return;
    if (node.type === 'folder' && getAncestorIds(state.collections, targetFolderId).includes(sourceId)) {
      return;
    }
    const target = findNode(state.collections, targetFolderId).node;
    if (!target || target.type !== 'folder') return;

    let collections = removeNode([...state.collections], sourceId);
    const targetLive = findNode(collections, targetFolderId).node;
    if (targetLive?.type === 'folder') {
      targetLive.children = [...targetLive.children, node];
    }
    set({ collections });
    void persistForNodeId(sourceId, collections);
    void persistForNodeId(targetFolderId, collections);
  },

  moveToRoot: (sourceId) => {
    const state = get();
    const { node, parent } = findNode(state.collections, sourceId);
    if (!node || !parent || isCollectionRoot(node)) return;

    let collections = removeNode([...state.collections], sourceId);
    const root = findCollectionRoot(collections, sourceId);
    if (root) {
      root.children = [...root.children, node];
      set({ collections });
      void persistCollectionRoot(root).catch(err => console.error('Failed to move to root:', err));
    }
  },
}));
