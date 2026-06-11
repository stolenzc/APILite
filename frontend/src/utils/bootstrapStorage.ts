import { invoke } from '@tauri-apps/api/core';
import { useFolderStore } from '../store/useFolderStore';
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
import { joinPath, FOLDERS_SUBDIR } from './storagePaths';
import { useScriptStore } from '../store/useScriptStore';
import { hydrateSessionFromStorage } from './sessionStorage';

/** Resolve data root, ensure layout, load folders and environments from disk. */
export async function bootstrapLocalStorage(): Promise<void> {
  if (isTauri()) {
    const { dataDir, setDataDir } = useSettingsStore.getState();
    let root = dataDir.trim();
    if (!root) {
      root = await invoke<string>('get_default_data_dir');
      setDataDir(root);
    }

    await invoke('ensure_data_dir', { dataDir: root });

    const foldersDir = joinPath(root, FOLDERS_SUBDIR);
    await useFolderStore.getState().initFolders(foldersDir);
    await hydrateEnvironmentsFromDisk();
    await useScriptStore.getState().hydrate();

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

  await hydrateSessionFromStorage();
}
