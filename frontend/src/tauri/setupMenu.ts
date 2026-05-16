import { Menu, MenuItem, PredefinedMenuItem, Submenu } from '@tauri-apps/api/menu';

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/** App menu with accelerators — only active while this app is focused (no OS-wide shortcuts). */
export async function setupTauriMenu(handlers: {
  onNewTab: () => void;
  onCloseTab: () => void;
  onPrevTab: () => void;
  onNextTab: () => void;
  onToggleSettings: () => void;
}): Promise<() => void> {
  const { onNewTab, onCloseTab, onPrevTab, onNextTab, onToggleSettings } = handlers;

  const settings = await MenuItem.new({
    id: 'settings',
    text: 'Settings...',
    accelerator: 'CommandOrControl+,',
    action: onToggleSettings,
  });

  const newTab = await MenuItem.new({
    id: 'tab-new',
    text: 'New Tab',
    accelerator: 'CommandOrControl+T',
    action: onNewTab,
  });

  const closeTab = await MenuItem.new({
    id: 'tab-close',
    text: 'Close Tab',
    accelerator: 'CommandOrControl+W',
    action: onCloseTab,
  });

  const prevTab = await MenuItem.new({
    id: 'tab-prev',
    text: 'Previous Tab',
    accelerator: 'CommandOrControl+Alt+Left',
    action: onPrevTab,
  });

  const nextTab = await MenuItem.new({
    id: 'tab-next',
    text: 'Next Tab',
    accelerator: 'CommandOrControl+Alt+Right',
    action: onNextTab,
  });

  const appSubmenu = await Submenu.new({
    text: 'APILite',
    items: [
      settings,
      await PredefinedMenuItem.new({ item: 'Separator' }),
      await PredefinedMenuItem.new({ item: 'Hide' }),
      await PredefinedMenuItem.new({ item: 'HideOthers' }),
      await PredefinedMenuItem.new({ item: 'Separator' }),
      await PredefinedMenuItem.new({ item: 'Quit' }),
    ],
  });

  const tabSubmenu = await Submenu.new({
    text: 'Tab',
    items: [newTab, closeTab, prevTab, nextTab],
  });

  const editSubmenu = await Submenu.new({
    text: 'Edit',
    items: [
      await PredefinedMenuItem.new({ item: 'Undo' }),
      await PredefinedMenuItem.new({ item: 'Redo' }),
      await PredefinedMenuItem.new({ item: 'Separator' }),
      await PredefinedMenuItem.new({ item: 'Cut' }),
      await PredefinedMenuItem.new({ item: 'Copy' }),
      await PredefinedMenuItem.new({ item: 'Paste' }),
      await PredefinedMenuItem.new({ item: 'SelectAll' }),
    ],
  });

  const menu = await Menu.new({
    items: [appSubmenu, tabSubmenu, editSubmenu],
  });
  await menu.setAsAppMenu();

  return () => {};
}
