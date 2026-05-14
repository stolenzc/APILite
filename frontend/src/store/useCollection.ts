import { create } from 'zustand';
import { nanoid } from 'nanoid';
import type { CollectionNode, CollectionFolder, CollectionRequest, HttpRequest, HttpMethod, KeyValue, BodyType } from '../types';

const defaultRequest: HttpRequest = {
  method: 'GET',
  url: '',
  params: [],
  headers: [],
  bodyType: 'none',
  rawContentType: 'json',
  body: '',
};

const STORAGE_KEY = 'APILite-collections';

function loadCollections(): CollectionNode[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return [];
}

function saveCollections(nodes: CollectionNode[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nodes));
  } catch { /* ignore */ }
}

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

interface CollectionStore {
  collections: CollectionNode[];
  activeNodeId: string | null;
  contextMenu: { nodeId: string; x: number; y: number } | null;

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
}

export const useCollectionStore = create<CollectionStore>((set, get) => ({
  collections: loadCollections(),
  activeNodeId: null,
  contextMenu: null,

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
    saveCollections(collections);
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
    saveCollections(collections);
    return { collections };
  }),

  renameNode: (id, name) => set(state => {
    const collections = updateNode([...state.collections], id, { name });
    saveCollections(collections);
    return { collections };
  }),

  deleteNode: (id) => set(state => {
    const collections = removeNode([...state.collections], id);
    saveCollections(collections);
    return { collections, activeNodeId: state.activeNodeId === id ? null : state.activeNodeId };
  }),

  toggleCollapse: (id) => set(state => {
    const node = findNode(state.collections, id).node;
    if (!node || node.type !== 'folder') return state;
    const collections = updateNode([...state.collections], id, { collapsed: !node.collapsed });
    saveCollections(collections);
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
    saveCollections(collections);
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
    const { node, path } = findNode(state.collections, sourceId);
    if (!node || node.type === 'folder') return state;
    // Don't move into own descendants
    if (getAncestorIds(state.collections, sourceId).includes(targetFolderId)) return state;
    // Remove from current location
    let collections = removeNode([...state.collections], sourceId);
    // Add to target folder
    const target = findNode(collections, targetFolderId).node;
    if (target && target.type === 'folder') {
      collections = updateNode(collections, targetFolderId, { children: [...(target as CollectionFolder).children, node] });
    }
    saveCollections(collections);
    return { collections };
  }),
}));
