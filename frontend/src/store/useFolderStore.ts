import { create } from 'zustand';
import { nanoid } from 'nanoid';
import { invoke } from '@tauri-apps/api/core';
import type { TreeNode, TreeFolder, TreeRequest, HttpRequest } from '../types';
import { cloneHttpRequest, normalizeHttpRequest } from '../utils/normalizeRequest';
import { getFoldersDir } from '../utils/storagePaths';
import { showToast } from '../utils/toast';
import { t } from '../i18n';
import { useStore } from './useStore';
import { useSettingsStore } from './useSettings';
import {
  normalizeFolderTree,
  normalizeFolderChildren,
  nextRequestSortOrder,
} from '../utils/folderTree';

const defaultRequest: HttpRequest = normalizeHttpRequest({ method: 'GET', url: '' });

function hasDiskFile(node: TreeNode): boolean {
  return node.type === 'folder' && !!node.fileName;
}

function asDiskFileFolder(node: TreeNode): TreeFolder | null {
  if (node.type === 'folder' && node.fileName) return node;
  return null;
}

function topLevelFolderNameTaken(folders: TreeNode[], name: string, exceptId?: string): boolean {
  const norm = name.trim().toLowerCase();
  if (!norm) return false;
  return folders.some(
    n => hasDiskFile(n) && n.id !== exceptId && n.name.trim().toLowerCase() === norm,
  );
}

function folderFilePayload(root: TreeFolder): string {
  return JSON.stringify({
    id: root.id,
    name: root.name,
    collapsed: root.collapsed,
    children: root.children,
  });
}

function findNode(
  nodes: TreeNode[],
  id: string,
): { node: TreeNode | null; parent: TreeFolder | null; path: TreeNode[] } {
  for (const node of nodes) {
    if (node.id === id) return { node, parent: null, path: [node] };
    if (node.type === 'folder') {
      const result = findNode(node.children, id);
      if (result.node) return { node: result.node, parent: node, path: [node, ...result.path] };
    }
  }
  return { node: null, parent: null, path: [] };
}

function findTopLevelDiskFolder(nodes: TreeNode[], nodeId: string): TreeFolder | null {
  for (const node of nodes) {
    if (node.type === 'folder' && node.fileName) {
      if (node.id === nodeId) return node;
      if (findNode(node.children, nodeId).node) return node;
    }
  }
  return null;
}

async function saveTopLevelDiskFolder(root: TreeFolder) {
  const dir = getFoldersDir();
  if (!dir || !root.fileName) return;
  await invoke('folders_save', {
    dir,
    fileName: root.fileName,
    data: folderFilePayload(root),
  });
}

async function persistForNodeId(nodeId: string, folders: TreeNode[]) {
  const root = findTopLevelDiskFolder(folders, nodeId);
  if (root) await saveTopLevelDiskFolder(root);
}

function defaultParentId(folders: TreeNode[], activeNodeId: string | null): string | null {
  if (activeNodeId) {
    const { node } = findNode(folders, activeNodeId);
    if (node?.type === 'folder') return node.id;
    const root = findTopLevelDiskFolder(folders, activeNodeId);
    if (root) return root.id;
  }
  const first = folders.find((n): n is TreeFolder => hasDiskFile(n));
  return first?.id ?? null;
}

export function getFolderPath(nodes: TreeNode[], id: string): string {
  const { path } = findNode(nodes, id);
  return path.map(n => n.name).join(' > ');
}

export function nodeInTree(nodes: TreeNode[], id: string): boolean {
  for (const n of nodes) {
    if (n.id === id) return true;
    if (n.type === 'folder' && nodeInTree(n.children, id)) return true;
  }
  return false;
}

/** Folder ids from tree root down to `nodeId` (inclusive), for expanding tree UIs. */
export function folderPathIds(nodes: TreeNode[], nodeId: string): string[] {
  const { path } = findNode(nodes, nodeId);
  return path.filter((n): n is TreeFolder => n.type === 'folder').map((n) => n.id);
}

function expandPathToNode(folders: TreeNode[], nodeId: string): TreeNode[] {
  const { node, path } = findNode(folders, nodeId);
  if (!node) return folders;
  const expandIds = new Set(
    path.filter((n): n is TreeFolder => n.type === 'folder').map((n) => n.id),
  );

  const mapNodes = (nodes: TreeNode[]): { nodes: TreeNode[]; changed: boolean } => {
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

  const { nodes, changed } = mapNodes(folders);
  return changed ? nodes : folders;
}

function removeNode(nodes: TreeNode[], id: string): TreeNode[] {
  return nodes
    .filter(n => n.id !== id)
    .map(n => (n.type === 'folder' ? { ...n, children: removeNode(n.children, id) } : n));
}

function updateNode(nodes: TreeNode[], id: string, update: Partial<TreeNode>): TreeNode[] {
  return nodes.map(n => {
    if (n.id === id) return { ...n, ...update } as TreeNode;
    if (n.type === 'folder') return { ...n, children: updateNode(n.children, id, update) };
    return n;
  });
}

function collapseFolderAndDescendants(folder: TreeFolder): TreeFolder {
  return {
    ...folder,
    collapsed: true,
    children: folder.children.map((c) =>
      c.type === 'folder' ? collapseFolderAndDescendants(c) : c,
    ),
  };
}

function collapseSubtreeInTree(nodes: TreeNode[], folderId: string): TreeNode[] {
  return nodes.map((n) => {
    if (n.type !== 'folder') return n;
    if (n.id === folderId) return collapseFolderAndDescendants(n);
    return { ...n, children: collapseSubtreeInTree(n.children, folderId) };
  });
}

function expandFolderInTree(nodes: TreeNode[], folderId: string): TreeNode[] {
  return nodes.map((n) => {
    if (n.type !== 'folder') return n;
    if (n.id === folderId) return { ...n, collapsed: false };
    return { ...n, children: expandFolderInTree(n.children, folderId) };
  });
}

function expandFolderAndDescendants(folder: TreeFolder): TreeFolder {
  return {
    ...folder,
    collapsed: false,
    children: folder.children.map((c) =>
      c.type === 'folder' ? expandFolderAndDescendants(c) : c,
    ),
  };
}

function expandFolderRecursiveInTree(nodes: TreeNode[], folderId: string): TreeNode[] {
  return nodes.map((n) => {
    if (n.type !== 'folder') return n;
    if (n.id === folderId) return expandFolderAndDescendants(n);
    return { ...n, children: expandFolderRecursiveInTree(n.children, folderId) };
  });
}

function collapseAllFoldersInTree(nodes: TreeNode[]): TreeNode[] {
  return nodes.map((n) =>
    n.type === 'folder' ? collapseFolderAndDescendants(n) : n,
  );
}

function expandAllFoldersInTree(nodes: TreeNode[]): TreeNode[] {
  return nodes.map((n) =>
    n.type === 'folder' ? expandFolderAndDescendants(n) : n,
  );
}

export function areAllFoldersCollapsed(nodes: TreeNode[]): boolean {
  for (const n of nodes) {
    if (n.type === 'folder') {
      if (!n.collapsed) return false;
      if (!areAllFoldersCollapsed(n.children)) return false;
    }
  }
  return true;
}

export function isFolderSubtreeFullyCollapsed(folder: TreeFolder): boolean {
  if (!folder.collapsed) return false;
  return folder.children.every(
    (c) => c.type === 'request' || isFolderSubtreeFullyCollapsed(c),
  );
}

async function persistAllDiskRoots(folders: TreeNode[]) {
  for (const node of folders) {
    if (node.type === 'folder' && node.fileName) {
      await saveTopLevelDiskFolder(node);
    }
  }
}

function duplicateNode(node: TreeNode): TreeNode {
  if (node.type === 'folder') {
    const copy: TreeFolder = {
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

function folderContainsId(nodes: TreeNode[], folderId: string, targetId: string): boolean {
  if (folderId === targetId) return true;
  const { node } = findNode(nodes, folderId);
  if (!node || node.type !== 'folder') return false;
  return findNode(node.children, targetId).node !== null;
}

function findParentFolder(nodes: TreeNode[], childId: string): TreeFolder | null {
  for (const node of nodes) {
    if (node.type !== 'folder') continue;
    if (node.children.some((c) => c.id === childId)) return node;
    const nested = findParentFolder(node.children, childId);
    if (nested) return nested;
  }
  return null;
}

interface FolderStore {
  folders: TreeNode[];
  activeNodeId: string | null;
  contextMenu: { nodeId: string; x: number; y: number } | null;
  pendingRenameNodeId: string | null;

  initFolders: (dir: string) => Promise<void>;
  addFolder: (parentId: string | null, options?: { startRename?: boolean }) => string | undefined;
  addRequest: (
    parentId: string | null,
    name?: string,
    request?: HttpRequest,
    id?: string,
    options?: { startRename?: boolean },
  ) => string | undefined;
  consumePendingRename: () => void;
  getRequestNode: (id: string) => TreeRequest | null;
  renameNode: (id: string, name: string) => boolean;
  updateRequest: (id: string, name: string, request: HttpRequest) => void;
  deleteNode: (id: string) => void;
  toggleCollapse: (id: string) => void;
  collapseAllFolders: () => void;
  expandAllFolders: () => void;
  toggleAllFoldersCollapse: () => void;
  toggleFolderSubtreeCollapse: (id: string) => void;
  cloneNode: (id: string) => void;
  setActiveNode: (id: string | null) => void;
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

export const useFolderStore = create<FolderStore>((set, get) => ({
  folders: [],
  activeNodeId: null,
  contextMenu: null,
  pendingRenameNodeId: null,

  consumePendingRename: () => set({ pendingRenameNodeId: null }),

  initFolders: async (dir: string) => {
    if (!dir) {
      set({ folders: [] });
      return;
    }
    try {
      const data: string = await invoke('load_folders', { dir });
      set({ folders: normalizeFolderTree(JSON.parse(data)) });
    } catch (err) {
      console.error('Failed to load folders:', err);
      set({ folders: [] });
    }
  },

  addFolder: (parentId, options) => {
    const startRename = options?.startRename !== false;
    if (parentId === null) {
      const name = 'New Folder';
      const trimmed = name.trim() || 'New Folder';
      if (topLevelFolderNameTaken(get().folders, trimmed)) {
        showToast(t('folder.duplicateTopLevelName'));
        return undefined;
      }
      const id = nanoid();
      const root: TreeFolder = {
        id,
        name: trimmed,
        type: 'folder',
        children: [],
        collapsed: useSettingsStore.getState().folderDefaultCollapsed,
        fileName: '',
      };
      set(state => ({
        folders: [...state.folders, root],
        pendingRenameNodeId: startRename ? id : state.pendingRenameNodeId,
        activeNodeId: id,
      }));
      const dir = getFoldersDir();
      if (!dir) return id;
      void invoke<string>('folders_create', { dir, id, name: trimmed })
        .then(fileName => {
          set(state => ({
            folders: updateNode(state.folders, id, { fileName } as Partial<TreeFolder>),
          }));
        })
        .catch(err => {
          console.error('Failed to create top-level folder:', err);
          set(state => ({ folders: removeNode(state.folders, id) }));
          if (String(err).includes('duplicate_top_level_folder_name')) {
            showToast(t('folder.duplicateTopLevelName'));
          }
        });
      return id;
    }

    const folders = [...get().folders];
    const parentKey = parentId;
    const folder: TreeFolder = {
      id: nanoid(),
      name: 'New Folder',
      type: 'folder',
      children: [],
      collapsed: useSettingsStore.getState().folderDefaultCollapsed,
    };
    const parent = findNode(folders, parentKey).node;
    if (parent?.type !== 'folder') return undefined;
    parent.collapsed = false;
    parent.children = normalizeFolderChildren([...parent.children, folder]);
    set({
      folders,
      pendingRenameNodeId: startRename ? folder.id : get().pendingRenameNodeId,
      activeNodeId: folder.id,
    });
    void persistForNodeId(parentKey, folders).catch(err =>
      console.error('Failed to save folder:', err),
    );
    return folder.id;
  },

  addRequest: (parentId, name = 'New Request', request = { ...defaultRequest }, id?: string, options?) => {
    const startRename = options?.startRename !== false;
    const folders = [...get().folders];
    const parentKey = parentId ?? defaultParentId(folders, get().activeNodeId);
    if (!parentKey) return undefined;

    const parent = findNode(folders, parentKey).node;
    if (parent?.type !== 'folder') return undefined;
    const node: TreeRequest = {
      id: id ?? nanoid(),
      name,
      type: 'request',
      request: { ...request, params: [...request.params], headers: [...request.headers] },
      sortOrder: nextRequestSortOrder(parent.children),
    };
    parent.collapsed = false;
    parent.children = normalizeFolderChildren([...parent.children, node]);
    set({
      folders,
      pendingRenameNodeId: startRename ? node.id : get().pendingRenameNodeId,
      activeNodeId: node.id,
    });
    void persistForNodeId(parentKey, folders).catch(err =>
      console.error('Failed to save request:', err),
    );
    return node.id;
  },

  getRequestNode: (id) => {
    const { node } = findNode(get().folders, id);
    return node?.type === 'request' ? node : null;
  },

  renameNode: (id, name) => {
    const trimmed = name.trim();
    if (!trimmed) return false;
    const { node } = findNode(get().folders, id);
    if (!node) return false;

    const topLevel = asDiskFileFolder(node);
    if (topLevel && topLevelFolderNameTaken(get().folders, trimmed, id)) {
      showToast(t('folder.duplicateTopLevelName'));
      return false;
    }

    let folders = updateNode([...get().folders], id, { name: trimmed });
    if (node.type === 'folder' && !hasDiskFile(node)) {
      const parent = findParentFolder(folders, id);
      if (parent) {
        parent.children = normalizeFolderChildren(parent.children);
      }
    }
    set({ folders });

    if (node.type === 'request') {
      useStore.getState().syncFolderTabName(id, trimmed);
    }

    if (topLevel?.fileName) {
      const dir = getFoldersDir();
      if (!dir) return true;
      void invoke<string>('folders_rename', { dir, fileName: topLevel.fileName, newName: trimmed })
        .then(fileName => {
          set(state => ({
            folders: updateNode(state.folders, id, { fileName, name: trimmed } as Partial<TreeFolder>),
          }));
          void persistForNodeId(id, get().folders);
        })
        .catch(err => {
          console.error('Failed to rename folder file:', err);
          if (String(err).includes('duplicate_top_level_folder_name')) {
            showToast(t('folder.duplicateTopLevelName'));
          }
        });
    } else {
      void persistForNodeId(id, folders).catch(err =>
        console.error('Failed to save rename:', err),
      );
    }
    return true;
  },

  updateRequest: (id, name, request) => {
    const folders = updateNode([...get().folders], id, {
      name,
      request: cloneHttpRequest(request),
    });
    set({ folders });
    void persistForNodeId(id, folders).catch(err =>
      console.error('Failed to update request:', err),
    );
  },

  deleteNode: (id) => {
    const { node } = findNode(get().folders, id);
    const root = findTopLevelDiskFolder(get().folders, id);
    const folders = removeNode([...get().folders], id);
    set({
      folders,
      activeNodeId: get().activeNodeId === id ? null : get().activeNodeId,
    });
    const dir = getFoldersDir();
    if (!dir || !node) return;

    const topLevel = asDiskFileFolder(node);
    if (topLevel?.fileName) {
      void invoke('folders_delete', { dir, fileName: topLevel.fileName }).catch(err =>
        console.error('Failed to delete folder file:', err),
      );
    } else if (root) {
      const updated = findNode(folders, root.id).node as TreeFolder | null;
      if (updated?.type === 'folder') {
        void saveTopLevelDiskFolder(updated).catch(err =>
          console.error('Failed to save after delete:', err),
        );
      }
    }
  },

  toggleCollapse: (id) => {
    const { node } = findNode(get().folders, id);
    if (!node || node.type !== 'folder') return;
    const folders = node.collapsed
      ? expandFolderInTree([...get().folders], id)
      : collapseSubtreeInTree([...get().folders], id);
    set({ folders });
    void persistForNodeId(id, folders).catch(err =>
      console.error('Failed to save collapse state:', err),
    );
  },

  collapseAllFolders: () => {
    const folders = collapseAllFoldersInTree([...get().folders]);
    set({ folders });
    void persistAllDiskRoots(folders).catch(err =>
      console.error('Failed to save collapse all:', err),
    );
  },

  expandAllFolders: () => {
    const folders = expandAllFoldersInTree([...get().folders]);
    set({ folders });
    void persistAllDiskRoots(folders).catch(err =>
      console.error('Failed to save expand all:', err),
    );
  },

  toggleAllFoldersCollapse: () => {
    const folders = areAllFoldersCollapsed(get().folders)
      ? expandAllFoldersInTree([...get().folders])
      : collapseAllFoldersInTree([...get().folders]);
    set({ folders });
    void persistAllDiskRoots(folders).catch(err =>
      console.error('Failed to save toggle all folders:', err),
    );
  },

  toggleFolderSubtreeCollapse: (id) => {
    const { node } = findNode(get().folders, id);
    if (!node || node.type !== 'folder') return;
    const folders = isFolderSubtreeFullyCollapsed(node)
      ? expandFolderRecursiveInTree([...get().folders], id)
      : collapseSubtreeInTree([...get().folders], id);
    set({ folders });
    void persistForNodeId(id, folders).catch(err =>
      console.error('Failed to save toggle folder subtree:', err),
    );
  },

  cloneNode: (id) => {
    const { node, parent } = findNode(get().folders, id);
    if (!node) return;
    const cloned = duplicateNode(node);
    const folders = [...get().folders];
    let persistId: string;

    if (parent) {
      if (node.type === 'request' && cloned.type === 'request') {
        const requests = parent.children.filter((c): c is TreeRequest => c.type === 'request');
        const idx = requests.findIndex((r) => r.id === id);
        requests.splice(idx + 1, 0, cloned as TreeRequest);
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
      if (cloned.type === 'folder' && hasDiskFile(node)) {
        if (topLevelFolderNameTaken(folders, cloned.name)) {
          showToast(t('folder.duplicateTopLevelName'));
          return;
        }
      }
      const idx = folders.findIndex(c => c.id === id);
      folders.splice(idx + 1, 0, cloned);
      persistId = asDiskFileFolder(node)?.id ?? cloned.id;
      if (cloned.type === 'folder' && hasDiskFile(node)) {
        const dir = getFoldersDir();
        if (dir) {
          void invoke<string>('folders_create', { dir, id: cloned.id, name: cloned.name })
            .then(fileName => {
              set(state => ({
                folders: updateNode(state.folders, cloned.id, { fileName } as Partial<TreeFolder>),
              }));
            });
        }
      }
    }
    set({ folders });
    void persistForNodeId(persistId, folders).catch(err =>
      console.error('Failed to clone:', err),
    );
  },

  setActiveNode: (activeNodeId) => set({ activeNodeId }),

  revealNode: (nodeId) =>
    set((state) => {
      if (!nodeId) {
        return state.activeNodeId === null ? state : { activeNodeId: null };
      }
      const { node } = findNode(state.folders, nodeId);
      if (!node) {
        return state.activeNodeId === null ? state : { activeNodeId: null };
      }
      const folders = expandPathToNode(state.folders, nodeId);
      if (state.activeNodeId === nodeId && folders === state.folders) {
        return state;
      }
      return { activeNodeId: nodeId, folders };
    }),

  loadRequest: (id) => {
    const { node } = findNode(get().folders, id);
    if (node && node.type === 'request') return normalizeHttpRequest(node.request);
    return null;
  },

  openContextMenu: (nodeId, x, y) => set({ contextMenu: { nodeId, x, y } }),
  closeContextMenu: () => set({ contextMenu: null }),

  moveRequest: (sourceId, targetId, position) => {
    const state = get();
    const { node: source } = findNode(state.folders, sourceId);
    if (!source || source.type !== 'request' || sourceId === targetId) return;

    const sourceRoot = findTopLevelDiskFolder(state.folders, sourceId);
    const sourceSnapshot: TreeRequest = {
      ...source,
      request: {
        ...source.request,
        params: source.request.params.map((p) => ({ ...p })),
        headers: source.request.headers.map((h) => ({ ...h })),
      },
    };

    let folders = removeNode([...state.folders], sourceId);

    if (position === 'inside') {
      const target = findNode(folders, targetId).node;
      if (!target || target.type !== 'folder') return;
      target.children = normalizeFolderChildren([
        ...target.children,
        { ...sourceSnapshot, sortOrder: nextRequestSortOrder(target.children) },
      ]);
    } else {
      const target = findNode(folders, targetId).node;
      if (!target || target.type !== 'request') return;
      const parent = findParentFolder(folders, targetId);
      if (!parent) return;

      const folderNodes = parent.children.filter((c): c is TreeFolder => c.type === 'folder');
      const requests = parent.children.filter((c): c is TreeRequest => c.type === 'request');
      const targetIdx = requests.findIndex((r) => r.id === targetId);
      if (targetIdx === -1) return;
      const insertIdx = position === 'before' ? targetIdx : targetIdx + 1;
      requests.splice(insertIdx, 0, sourceSnapshot);
      parent.children = normalizeFolderChildren([...folderNodes, ...requests]);
    }

    set({ folders });

    if (sourceRoot) {
      const updatedRoot = findNode(folders, sourceRoot.id).node;
      if (updatedRoot?.type === 'folder') {
        void saveTopLevelDiskFolder(updatedRoot).catch((err) =>
          console.error('Failed to save folder after move:', err),
        );
      }
    }
  },

  moveFolder: (sourceId, targetFolderId) => {
    if (sourceId === targetFolderId) return;
    const state = get();
    const { node: source } = findNode(state.folders, sourceId);
    if (!source || source.type !== 'folder' || hasDiskFile(source)) return;

    const target = findNode(state.folders, targetFolderId).node;
    if (!target || target.type !== 'folder') return;
    if (folderContainsId(state.folders, sourceId, targetFolderId)) return;

    const sourceRoot = findTopLevelDiskFolder(state.folders, sourceId);

    let folders = removeNode([...state.folders], sourceId);
    const targetLive = findNode(folders, targetFolderId).node;
    if (!targetLive || targetLive.type !== 'folder') return;

    targetLive.collapsed = false;
    targetLive.children = normalizeFolderChildren([...targetLive.children, source]);
    set({ folders });

    if (sourceRoot) {
      const updatedRoot = findNode(folders, sourceRoot.id).node;
      if (updatedRoot?.type === 'folder') {
        void saveTopLevelDiskFolder(updatedRoot).catch((err) =>
          console.error('Failed to save folder after folder move:', err),
        );
      }
    }
  },
}));
