import { create } from 'zustand';
import { nanoid } from 'nanoid';
import { invoke } from '@tauri-apps/api/core';
import type { CollectionNode, CollectionFolder, CollectionRequest, HttpRequest, HttpMethod, KeyValue, BodyType } from '../types';
import { useSettingsStore } from './useSettings';

const defaultRequest: HttpRequest = {
  method: 'GET',
  url: '',
  params: [],
  headers: [],
  bodyType: 'none',
  rawContentType: 'json',
  body: '',
};

// Utility: find node by id in tree, return path
function findNode(nodes: CollectionNode[], id: string): { node: CollectionNode | null; parent: CollectionFolder | null; path: CollectionNode[] } {
  for (const node of nodes) {
    if (node.id === id) return { node, parent: null, path: [node] };
    if (node.type === 'folder') {
      const result = findNode(node.children, id);
      if (result.node) return { node: result.node, parent: node, path: [node, ...result.path] };
    }
  }
  return { node: null, parent: null, path: [] };
}

// Utility: remove node by id from tree
function removeNode(nodes: CollectionNode[], id: string): CollectionNode[] {
  return nodes.filter(n => n.id !== id).map(n =>
    n.type === 'folder' ? { ...n, children: removeNode(n.children, id) } : n
  );
}

// Utility: update node in tree
function updateNode(nodes: CollectionNode[], id: string, update: Partial<CollectionNode>): CollectionNode[] {
  return nodes.map(n => {
    if (n.id === id) return { ...n, ...update } as CollectionNode;
    if (n.type === 'folder') return { ...n, children: updateNode(n.children, id, update) };
    return n;
  });
}

// Utility: deep clone a node
function cloneNode(node: CollectionNode): CollectionNode {
  if (node.type === 'folder') return { ...node, id: nanoid(), children: node.children.map(cloneNode) };
  return { ...node, id: nanoid(), request: { ...node.request, params: [...node.request.params], headers: [...node.request.headers] } };
}

// Utility: find all ancestors of a node
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

// Persist to file system via Tauri
async function persistCollections(dir: string, collections: CollectionNode[]) {
  if (!dir) return;
  try {
    await invoke('save_collections', { dir, data: JSON.stringify(collections, null, 2) });
  } catch (err) {
    console.error('Failed to save collections:', err);
  }
}

interface CollectionStore {
  collections: CollectionNode[];
  activeNodeId: string | null;
  contextMenu: { nodeId: string; x: number; y: number } | null;

  // Init
  initCollections: (dir: string) => Promise<void>;

  // CRUD
  addFolder: (parentId: string | null) => void;
  addRequest: (parentId: string | null, name?: string, request?: HttpRequest) => void;
  renameNode: (id: string, name: string) => void;
  deleteNode: (id: string) => void;
  toggleCollapse: (id: string) => void;
  cloneNode: (id: string) => void;

  // Active node
  setActiveNode: (id: string | null) => void;
  loadRequest: (id: string) => HttpRequest | null;

  // Context menu
  openContextMenu: (nodeId: string, x: number, y: number) => void;
  closeContextMenu: () => void;

  // Move
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

  addFolder: (parentId) => set(state => {
    const folder: CollectionFolder = {
      id: nanoid(),
      name: 'New Folder',
      type: 'folder',
      children: [],
      collapsed: false,
    };
    let collections = [...state.collections];
    if (parentId) {
      collections = updateNode(collections, parentId, { children: [...(findNode(collections, parentId).node as CollectionFolder)?.children || [], folder] });
    } else {
      collections = [...collections, folder];
    }
    persistCollections(useSettingsStore.getState().collectionDir, collections);
    return { collections };
  }),

  addRequest: (parentId, name = 'New Request', request = { ...defaultRequest }) => set(state => {
    const node: CollectionRequest = {
      id: nanoid(),
      name,
      type: 'request',
      request: { ...request, params: [...request.params], headers: [...request.headers] },
    };
    let collections = [...state.collections];
    if (parentId) {
      const parent = findNode(collections, parentId);
      if (parent.node && parent.node.type === 'folder') {
        collections = updateNode(collections, parentId, { children: [...(parent.node as CollectionFolder).children, node] });
      }
    } else {
      collections = [...collections, node];
    }
    persistCollections(useSettingsStore.getState().collectionDir, collections);
    return { collections };
  }),

  renameNode: (id, name) => set(state => {
    const collections = updateNode([...state.collections], id, { name });
    persistCollections(useSettingsStore.getState().collectionDir, collections);
    return { collections };
  }),

  deleteNode: (id) => set(state => {
    const collections = removeNode([...state.collections], id);
    persistCollections(useSettingsStore.getState().collectionDir, collections);
    return { collections, activeNodeId: state.activeNodeId === id ? null : state.activeNodeId };
  }),

  toggleCollapse: (id) => set(state => {
    const node = findNode(state.collections, id).node;
    if (!node || node.type !== 'folder') return state;
    const collections = updateNode([...state.collections], id, { collapsed: !node.collapsed });
    persistCollections(useSettingsStore.getState().collectionDir, collections);
    return { collections };
  }),

  cloneNode: (id) => set(state => {
    const { node, parent } = findNode(state.collections, id);
    if (!node) return state;
    const cloned = cloneNode(node);
    let collections = [...state.collections];
    if (parent) {
      const parentFolder = findNode(collections, parent.id).node as CollectionFolder;
      const idx = parentFolder.children.findIndex(c => c.id === id);
      const children = [...parentFolder.children];
      children.splice(idx + 1, 0, cloned);
      collections = updateNode(collections, parent.id, { children });
    } else {
      const idx = collections.findIndex(c => c.id === id);
      collections.splice(idx + 1, 0, cloned);
    }
    persistCollections(useSettingsStore.getState().collectionDir, collections);
    return { collections };
  }),

  setActiveNode: (activeNodeId) => set({ activeNodeId }),

  loadRequest: (id) => {
    const { node } = findNode(get().collections, id);
    if (node && node.type === 'request') return node.request;
    return null;
  },

  openContextMenu: (nodeId, x, y) => set({ contextMenu: { nodeId, x, y } }),
  closeContextMenu: () => set({ contextMenu: null }),

  moveNode: (sourceId, targetFolderId) => set(state => {
    const { node } = findNode(state.collections, sourceId);
    if (!node || sourceId === targetFolderId) return state;
    // Prevent moving a folder into itself or its descendants
    if (node.type === 'folder' && getAncestorIds(state.collections, targetFolderId).includes(sourceId)) return state;
    let collections = removeNode([...state.collections], sourceId);
    const target = findNode(collections, targetFolderId).node;
    if (target && target.type === 'folder') {
      collections = updateNode(collections, targetFolderId, { children: [...(target as CollectionFolder).children, node] });
    }
    persistCollections(useSettingsStore.getState().collectionDir, collections);
    return { collections };
  }),

  moveToRoot: (sourceId) => set(state => {
    const { node } = findNode(state.collections, sourceId);
    if (!node) return state;
    const collections = [...removeNode([...state.collections], sourceId), node];
    persistCollections(useSettingsStore.getState().collectionDir, collections);
    return { collections };
  }),
}));
