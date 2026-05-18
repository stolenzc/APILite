import { create } from 'zustand';
import { setLocale as applyI18nLocale, type Locale } from '../i18n';

export interface ShortcutConfig {
  sendRequest: string;
  saveRequest: string;
  exportCurl: string;
  focusUrl: string;
  toggleSettings: string;
  newTab: string;
  closeTab: string;
  prevTab: string;
  nextTab: string;
}

const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform) ||
  ((navigator as any).userAgentData?.platform === 'macOS');
const mod = isMac ? 'Cmd' : 'Ctrl';

export const defaultShortcuts: ShortcutConfig = {
  sendRequest: `${mod}+Enter`,
  saveRequest: `${mod}+S`,
  exportCurl: `${mod}+Shift+E`,
  focusUrl: `${mod}+L`,
  toggleSettings: `${mod}+,`,
  newTab: `${mod}+T`,
  closeTab: `${mod}+W`,
  prevTab: `${mod}+Alt+ArrowLeft`,
  nextTab: `${mod}+Alt+ArrowRight`,
};

export interface AppSettings {
  theme: string;
  locale: Locale;
  shortcuts: ShortcutConfig;
  responseHeight: number;
  historyHeight: number;
  historyCollapsed: boolean;
  collectionDir: string;
  autoCompleteProtocol: boolean;
}

export const defaultSettings: AppSettings = {
  theme: 'dark',
  locale: 'en',
  shortcuts: { ...defaultShortcuts },
  responseHeight: 300,
  historyHeight: 250,
  historyCollapsed: true,
  collectionDir: '',
  autoCompleteProtocol: true,
};

function migrateShortcuts(shortcuts: Partial<ShortcutConfig> & Record<string, string>): ShortcutConfig {
  const currentMod = isMac ? 'Cmd' : 'Ctrl';
  const oldMod = isMac ? 'Ctrl' : 'Cmd';
  const merged = { ...defaultShortcuts, ...shortcuts };
  const migrated = { ...defaultShortcuts };
  for (const key of Object.keys(defaultShortcuts) as (keyof ShortcutConfig)[]) {
    const value = merged[key] ?? defaultShortcuts[key];
    migrated[key] = value.startsWith(oldMod + '+')
      ? value.replace(oldMod + '+', currentMod + '+')
      : value;
  }
  return migrated;
}

function loadSettings(): AppSettings {
  try {
    const stored = localStorage.getItem('APILite-settings');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.shortcuts) {
        parsed.shortcuts = migrateShortcuts({ ...defaultShortcuts, ...parsed.shortcuts });
      }
      return parsed;
    }
  } catch { /* ignore */ }
  return { ...defaultSettings };
}

function saveSettings(settings: AppSettings) {
  try {
    localStorage.setItem('APILite-settings', JSON.stringify(settings));
  } catch { /* ignore */ }
}

interface SettingsState extends AppSettings {
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  setTheme: (theme: string) => void;
  setLocale: (locale: Locale) => void;
  updateShortcut: (key: keyof ShortcutConfig, value: string) => void;
  resetShortcuts: () => void;
  resetSettings: () => void;
  setResponseHeight: (height: number) => void;
  setHistoryHeight: (height: number) => void;
  setHistoryCollapsed: (collapsed: boolean) => void;
  setCollectionDir: (dir: string) => void;
  setAutoCompleteProtocol: (auto: boolean) => void;
}

export const useSettingsStore = create<SettingsState>((set) => {
  const initial = loadSettings();
  applyI18nLocale(initial.locale);

  return {
    ...initial,
    settingsOpen: false,

    setSettingsOpen: (settingsOpen) => set({ settingsOpen }),

    setTheme: (theme) => set(state => {
      const next = { ...state, theme };
      saveSettings(next);
      return next;
    }),

    setLocale: (locale) => set((state) => {
      applyI18nLocale(locale);
      const next = { ...state, locale };
      saveSettings(next);
      return next;
    }),

    updateShortcut: (key, value) => set(state => {
      const next = {
        ...state,
        shortcuts: { ...state.shortcuts, [key]: value },
      };
      saveSettings(next);
      return next;
    }),

    resetShortcuts: () => set(state => {
      const next = { ...state, shortcuts: { ...defaultShortcuts } };
      saveSettings(next);
      return next;
    }),

    resetSettings: () => set(() => {
      saveSettings(defaultSettings);
      applyI18nLocale(defaultSettings.locale);
      return { ...defaultSettings, settingsOpen: true };
    }),

    setResponseHeight: (responseHeight) => set(state => {
      const next = { ...state, responseHeight };
      saveSettings(next);
      return next;
    }),

    setHistoryHeight: (historyHeight) => set(state => {
      const next = { ...state, historyHeight };
      saveSettings(next);
      return next;
    }),

    setHistoryCollapsed: (historyCollapsed) => set(state => {
      const next = { ...state, historyCollapsed };
      saveSettings(next);
      return next;
    }),

    setCollectionDir: (collectionDir) => set(state => {
      const next = { ...state, collectionDir };
      saveSettings(next);
      return next;
    }),

    setAutoCompleteProtocol: (autoCompleteProtocol) => set(state => {
      const next = { ...state, autoCompleteProtocol };
      saveSettings(next);
      return next;
    }),
  };
});

// Keyboard shortcut dispatcher (browser dev mode; Tauri uses native menu accelerators)
export function initKeyboardShortcuts(): () => void {
  const handler = (e: KeyboardEvent) => {
    const shortcuts = useSettingsStore.getState().shortcuts;
    const combo = buildCombo(e);

    if (combo === shortcuts.sendRequest) {
      e.preventDefault();
      const sendBtn = document.querySelector('.btn-send') as HTMLElement | null;
      sendBtn?.click();
      return;
    }

    if (combo === shortcuts.saveRequest) {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('shortcut:save-request'));
      return;
    }

    if (combo === shortcuts.focusUrl) {
      e.preventDefault();
      const urlInput = document.querySelector('.url-input') as HTMLInputElement | null;
      urlInput?.focus();
      urlInput?.select();
      return;
    }

    if (combo === shortcuts.toggleSettings) {
      e.preventDefault();
      useSettingsStore.getState().setSettingsOpen(!useSettingsStore.getState().settingsOpen);
      return;
    }

    if (combo === shortcuts.newTab) {
      e.preventDefault();
      e.stopPropagation();
      window.dispatchEvent(new CustomEvent('shortcut:new-tab'));
      return;
    }

    if (combo === shortcuts.closeTab) {
      e.preventDefault();
      e.stopPropagation();
      window.dispatchEvent(new CustomEvent('shortcut:close-tab'));
      return;
    }

    if (combo === shortcuts.prevTab) {
      e.preventDefault();
      e.stopPropagation();
      window.dispatchEvent(new CustomEvent('shortcut:prev-tab'));
      return;
    }

    if (combo === shortcuts.nextTab) {
      e.preventDefault();
      e.stopPropagation();
      window.dispatchEvent(new CustomEvent('shortcut:next-tab'));
      return;
    }

    // ESC to close settings
    if (e.key === 'Escape' && useSettingsStore.getState().settingsOpen) {
      e.preventDefault();
      useSettingsStore.getState().setSettingsOpen(false);
      return;
    }
  };

  document.addEventListener('keydown', handler, { capture: true });
  return () => document.removeEventListener('keydown', handler, { capture: true });
}

function normalizeKey(e: KeyboardEvent | React.KeyboardEvent): string {
  if (e.key === ',' || e.code === 'Comma') return ',';
  if (e.key.length === 1) return e.key.toUpperCase();
  return e.key;
}

export function buildCombo(e: KeyboardEvent | React.KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey) parts.push('Ctrl');
  if (e.metaKey) parts.push('Cmd');
  if (e.shiftKey) parts.push('Shift');
  if (e.altKey) parts.push('Alt');

  const key = normalizeKey(e);
  if (key !== 'Control' && key !== 'Meta' && key !== 'Shift' && key !== 'Alt') {
    parts.push(key);
  }

  return parts.join('+');
}

export function matchesShortcut(e: KeyboardEvent | React.KeyboardEvent, shortcut: string): boolean {
  return buildCombo(e) === shortcut;
}
