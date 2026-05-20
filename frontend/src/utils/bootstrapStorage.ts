import { invoke } from '@tauri-apps/api/core';
import { useCollectionStore } from '../store/useCollection';
import { useSettingsStore } from '../store/useSettings';
import { hydrateEnvironmentsFromDisk } from '../store/useEnvironmentStore';
import { useStore } from '../store/useStore';
import { isTauri } from '../tauri/setupMenu';
import {
  hydrateHistoryFromDisk,
  loadFullFromLocalStoragePruned,
  loadInitialHistoryPage,
  saveFullHistory,
} from './historyStorage';
import { getCollectionsDir, joinPath, COLLECTIONS_SUBDIR } from './storagePaths';

/** Resolve data root, ensure layout, load collections and environments from disk. */
export async function bootstrapLocalStorage(): Promise<void> {
  if (!isTauri()) return;

  const { dataDir, setDataDir } = useSettingsStore.getState();
  let root = dataDir.trim();
  if (!root) {
    root = await invoke<string>('get_default_data_dir');
    setDataDir(root);
  }

  await invoke('ensure_data_dir', { dataDir: root });

  const collectionsDir = joinPath(root, COLLECTIONS_SUBDIR);
  await useCollectionStore.getState().initCollections(collectionsDir);
  await hydrateEnvironmentsFromDisk();

  const fromDisk = await hydrateHistoryFromDisk();
  if (fromDisk != null) {
    useStore.setState({
      history: fromDisk.entries,
      historyHasMore: fromDisk.hasMore,
      historyLoadingMore: false,
    });
  } else {
    const full = loadFullFromLocalStoragePruned();
    if (full.length > 0) {
      await saveFullHistory(full);
      const page = loadInitialHistoryPage();
      useStore.setState({
        history: page.entries,
        historyHasMore: page.hasMore,
        historyLoadingMore: false,
      });
    }
  }
}
