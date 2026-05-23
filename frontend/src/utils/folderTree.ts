import type { TreeFolder, TreeNode, TreeRequest } from '../types';

function compareFolderName(a: TreeFolder, b: TreeFolder): number {
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
}

function requestSortKey(req: TreeRequest, indexAmongRequests: number): number {
  return typeof req.sortOrder === 'number' ? req.sortOrder : indexAmongRequests * 10;
}

/** Folders first (by name), then requests (by sortOrder / add order). Recurses into folders. */
export function normalizeFolderChildren(children: TreeNode[]): TreeNode[] {
  const folders = children
    .filter((c): c is TreeFolder => c.type === 'folder')
    .map((f) => ({
      ...f,
      children: normalizeFolderChildren(f.children),
    }))
    .sort(compareFolderName);

  const requests = children
    .filter((c): c is TreeRequest => c.type === 'request')
    .map((r, index) => ({
      ...r,
      sortOrder: requestSortKey(r, index),
    }))
    .sort((a, b) => a.sortOrder! - b.sortOrder!);

  return [...folders, ...requests];
}

export function normalizeFolderTree(folders: TreeNode[]): TreeNode[] {
  return folders.map((node) => {
    if (node.type !== 'folder') return node;
    return { ...node, children: normalizeFolderChildren(node.children) };
  });
}

export function nextRequestSortOrder(children: TreeNode[]): number {
  let max = -10;
  for (const child of children) {
    if (child.type === 'request') {
      max = Math.max(max, requestSortKey(child, 0));
    }
  }
  return max + 10;
}
