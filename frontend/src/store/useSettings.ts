import { create } from 'zustand';
import { setLocale as applyI18nLocale, type Locale } from '../i18n';
import { focusUrlInput } from '../utils/focusUrl';
import { useEnvironmentStore } from './useEnvironmentStore';
import { migrateStoragePath } from '../utils/storagePaths';

export interface ShortcutConfig {
  sendRequest: string;
  saveRequest: string;
  focusUrl: string;
  focusCollectionSearch: string;
  toggleSettings: string;
  toggleHistory: string;
  toggleCollectionSidebar: string;
  toggleCurlPanel: string;
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
  focusUrl: `${mod}+L`,
  focusCollectionSearch: `${mod}+Shift+F`,
  toggleSettings: `${mod}+,`,
  toggleHistory: 'Ctrl+`',
  toggleCollectionSidebar: `${mod}+B`,
  toggleCurlPanel: `${mod}+Alt+B`,
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
  collectionSidebarOpen: boolean;
  collectionSidebarWidth: number;
  curlPanelOpen: boolean;
  curlPanelWidth: number;
  curlPanelCollapsed: boolean;
  /** Local data root: contains `collections/`, `histories/`, and `environments.json`. */
  dataDir: string;
  autoCompleteProtocol: boolean;
  /** Drop history entries older than this many days. */
  historyMaxAgeDays: number;
  /** Maximum number of history entries to keep (newest first). */
  historyMaxCount: number;
}

export const defaultSettings: AppSettings = {
  theme: 'dark',
  locale: 'en',
  shortcuts: { ...defaultShortcuts },
  responseHeight: 300,
  historyHeight: 250,
  historyCollapsed: true,
  collectionSidebarOpen: true,
  collectionSidebarWidth: 260,
  curlPanelOpen: true,
  curlPanelWidth: 360,
  curlPanelCollapsed: false,
  dataDir: '',
  autoCompleteProtocol: true,
  historyMaxAgeDays: 30,
  historyMaxCount: 1000,
};

const HISTORY_AGE_MIN = 1;
const HISTORY_AGE_MAX = 3650;
const HISTORY_COUNT_MIN = 50;
const HISTORY_COUNT_MAX = 10000;

function clampHistoryMaxAgeDays(days: number): number {
  if (!Number.isFinite(days)) return defaultSettings.historyMaxAgeDays;
  return Math.min(HISTORY_AGE_MAX, Math.max(HISTORY_AGE_MIN, Math.round(days)));
}

function clampHistoryMaxCount(count: number): number {
  if (!Number.isFinite(count)) return defaultSettings.historyMaxCount;
  return Math.min(HISTORY_COUNT_MAX, Math.max(HISTORY_COUNT_MIN, Math.round(count)));
}

function migrateShortcuts(shortcuts: Partial<ShortcutConfig> & Record<string, string>): ShortcutConfig {
  const currentMod = isMac ? 'Cmd' : 'Ctrl';
  const oldMod = isMac ? 'Ctrl' : 'Cmd';
  const merged: Partial<ShortcutConfig> & Record<string, string> = { ...defaultShortcuts, ...shortcuts };
  // Pre-toggleCurlPanel settings stored the cURL shortcut as exportCurl.
  const legacyExportCurl = shortcuts.exportCurl?.trim();
  if (legacyExportCurl && !shortcuts.toggleCurlPanel?.trim()) {
    merged.toggleCurlPanel = legacyExportCurl;
  }
  const migrated = { ...defaultShortcuts };
  for (const key of Object.keys(defaultShortcuts) as (keyof ShortcutConfig)[]) {
    const raw = merged[key]?.trim();
    const value = raw || defaultShortcuts[key];
    if (key === 'toggleHistory') {
      migrated[key] = value === `${currentMod}+\`` || value === `${oldMod}+\``
        ? defaultShortcuts.toggleHistory
        : value;
      continue;
    }
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
      const parsed = JSON.parse(stored) as Partial<AppSettings> & { collectionDir?: string };
      return {
        ...defaultSettings,
        ...parsed,
        shortcuts: migrateShortcuts({ ...defaultShortcuts, ...parsed.shortcuts }),
        dataDir: migrateStoragePath(parsed),
        historyMaxAgeDays: clampHistoryMaxAgeDays(
          parsed.historyMaxAgeDays ?? defaultSettings.historyMaxAgeDays,
        ),
        historyMaxCount: clampHistoryMaxCount(
          parsed.historyMaxCount ?? defaultSettings.historyMaxCount,
        ),
      };
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
  setCollectionSidebarOpen: (open: boolean) => void;
  setCollectionSidebarWidth: (width: number) => void;
  setCurlPanelOpen: (open: boolean) => void;
  setCurlPanelWidth: (width: number) => void;
  setCurlPanelCollapsed: (collapsed: boolean) => void;
  setDataDir: (dir: string) => void;
  setAutoCompleteProtocol: (auto: boolean) => void;
  setHistoryMaxAgeDays: (days: number) => void;
  setHistoryMaxCount: (count: number) => void;
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
      const trimmed = value.trim();
      if (!trimmed) return state;
      const next = {
        ...state,
        shortcuts: { ...state.shortcuts, [key]: trimmed },
      };
      saveSettings(next);
      return next;
    }),

    resetShortcuts: () => set(state => {
      const next = { ...state, shortcuts: { ...defaultShortcuts } };
      saveSettings(next);
      return next;
    }),

    resetSettings: () => {
      saveSettings(defaultSettings);
      applyI18nLocale(defaultSettings.locale);
      import('./useStore').then(({ useStore }) => {
        useStore.getState().syncHistoryRetention();
      });
      set({ ...defaultSettings, settingsOpen: true });
    },

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

    setCollectionSidebarOpen: (collectionSidebarOpen) => set(state => {
      const next = { ...state, collectionSidebarOpen };
      saveSettings(next);
      return next;
    }),

    setCollectionSidebarWidth: (collectionSidebarWidth) => set(state => {
      const next = { ...state, collectionSidebarWidth: Math.round(collectionSidebarWidth) };
      saveSettings(next);
      return next;
    }),

    setCurlPanelOpen: (curlPanelOpen) => set(state => {
      const next = { ...state, curlPanelOpen };
      saveSettings(next);
      return next;
    }),

    setCurlPanelWidth: (curlPanelWidth) => set(state => {
      const next = { ...state, curlPanelWidth: Math.round(curlPanelWidth) };
      saveSettings(next);
      return next;
    }),

    setCurlPanelCollapsed: (curlPanelCollapsed) => set(state => {
      const next = { ...state, curlPanelCollapsed };
      saveSettings(next);
      return next;
    }),

    setDataDir: (dataDir) => set(state => {
      const next = { ...state, dataDir: dataDir.trim() };
      saveSettings(next);
      return next;
    }),

    setAutoCompleteProtocol: (autoCompleteProtocol) => set(state => {
      const next = { ...state, autoCompleteProtocol };
      saveSettings(next);
      return next;
    }),

    setHistoryMaxAgeDays: (historyMaxAgeDays) => set(state => {
      const next = {
        ...state,
        historyMaxAgeDays: clampHistoryMaxAgeDays(historyMaxAgeDays),
      };
      saveSettings(next);
      import('./useStore').then(({ useStore }) => {
        useStore.getState().syncHistoryRetention();
      });
      return next;
    }),

    setHistoryMaxCount: (historyMaxCount) => set(state => {
      const next = {
        ...state,
        historyMaxCount: clampHistoryMaxCount(historyMaxCount),
      };
      saveSettings(next);
      import('./useStore').then(({ useStore }) => {
        useStore.getState().syncHistoryRetention();
      });
      return next;
    }),
  };
});

export function toggleSettingsPanel() {
  const open = useSettingsStore.getState().settingsOpen;
  useSettingsStore.getState().setSettingsOpen(!open);
}

export function toggleCurlPanelVisibility() {
  const { curlPanelOpen, setCurlPanelOpen, setCurlPanelCollapsed } = useSettingsStore.getState();
  if (!curlPanelOpen) {
    setCurlPanelOpen(true);
    setCurlPanelCollapsed(false);
  } else {
    setCurlPanelOpen(false);
  }
}

function isToggleSettingsKey(e: KeyboardEvent | React.KeyboardEvent): boolean {
  const mod = isMac ? e.metaKey : e.ctrlKey;
  return mod && !e.shiftKey && !e.altKey && (e.key === ',' || e.code === 'Comma');
}

/** Physical Ctrl+` (not Cmd); macOS Option does not alter this key. */
function isToggleHistoryKey(e: KeyboardEvent | React.KeyboardEvent): boolean {
  return e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey
    && (e.key === '`' || e.code === 'Backquote');
}

/** Cmd+Opt+B / Ctrl+Alt+B — use physical KeyB; Option on Mac changes e.key away from "b". */
function isToggleCurlPanelKey(e: KeyboardEvent | React.KeyboardEvent): boolean {
  if (e.shiftKey || e.code !== 'KeyB') return false;
  if (isMac) return e.metaKey && e.altKey && !e.ctrlKey;
  return e.ctrlKey && e.altKey && !e.metaKey;
}

export function matchesShortcutCombo(
  e: KeyboardEvent | React.KeyboardEvent,
  shortcut: string,
): boolean {
  const trimmed = shortcut.trim();
  if (!trimmed) return false;
  if (buildCombo(e) === trimmed) return true;
  if (trimmed === defaultShortcuts.toggleSettings && isToggleSettingsKey(e)) return true;
  if ((trimmed === defaultShortcuts.toggleHistory || trimmed.startsWith('Ctrl+`'))
    && isToggleHistoryKey(e)) {
    return true;
  }
  if (trimmed === defaultShortcuts.toggleCurlPanel && isToggleCurlPanelKey(e)) return true;
  return false;
}

function handleEscapeKey(e: KeyboardEvent) {
  if (e.key !== 'Escape') return false;
  const { envModalOpen, setEnvModalOpen } = useEnvironmentStore.getState();
  if (envModalOpen) {
    e.preventDefault();
    setEnvModalOpen(false);
    return true;
  }
  if (useSettingsStore.getState().settingsOpen) {
    e.preventDefault();
    useSettingsStore.getState().setSettingsOpen(false);
    return true;
  }
  return false;
}

// Keyboard shortcut dispatcher (capture phase; works with Tauri menu actions via custom events)
export function initKeyboardShortcuts(): () => void {
  const handler = (e: KeyboardEvent) => {
    if (handleEscapeKey(e)) return;

    const shortcuts = useSettingsStore.getState().shortcuts;

    if (matchesShortcutCombo(e, shortcuts.toggleSettings)) {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('shortcut:toggle-settings'));
      return;
    }

    if (matchesShortcutCombo(e, shortcuts.sendRequest)) {
      e.preventDefault();
      const sendBtn = document.querySelector('.btn-send') as HTMLElement | null;
      sendBtn?.click();
      return;
    }

    if (matchesShortcutCombo(e, shortcuts.saveRequest)) {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('shortcut:save-request'));
      return;
    }

    if (matchesShortcutCombo(e, shortcuts.focusUrl)) {
      e.preventDefault();
      focusUrlInput();
      return;
    }

    if (matchesShortcutCombo(e, shortcuts.focusCollectionSearch)) {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('app:focus-collection-search'));
      return;
    }

    if (matchesShortcutCombo(e, shortcuts.toggleHistory)) {
      e.preventDefault();
      const { historyCollapsed, setHistoryCollapsed } = useSettingsStore.getState();
      setHistoryCollapsed(!historyCollapsed);
      return;
    }

    if (matchesShortcutCombo(e, shortcuts.toggleCurlPanel)) {
      e.preventDefault();
      toggleCurlPanelVisibility();
      return;
    }

    if (matchesShortcutCombo(e, shortcuts.toggleCollectionSidebar)) {
      e.preventDefault();
      const { collectionSidebarOpen, setCollectionSidebarOpen } = useSettingsStore.getState();
      setCollectionSidebarOpen(!collectionSidebarOpen);
      return;
    }

    if (matchesShortcutCombo(e, shortcuts.newTab)) {
      e.preventDefault();
      e.stopPropagation();
      window.dispatchEvent(new CustomEvent('shortcut:new-tab'));
      return;
    }

    if (matchesShortcutCombo(e, shortcuts.closeTab)) {
      e.preventDefault();
      e.stopPropagation();
      window.dispatchEvent(new CustomEvent('shortcut:close-tab'));
      return;
    }

    if (matchesShortcutCombo(e, shortcuts.prevTab)) {
      e.preventDefault();
      e.stopPropagation();
      window.dispatchEvent(new CustomEvent('shortcut:prev-tab'));
      return;
    }

    if (matchesShortcutCombo(e, shortcuts.nextTab)) {
      e.preventDefault();
      e.stopPropagation();
      window.dispatchEvent(new CustomEvent('shortcut:next-tab'));
      return;
    }
  };

  document.addEventListener('keydown', handler, { capture: true });
  return () => document.removeEventListener('keydown', handler, { capture: true });
}

function normalizeKey(e: KeyboardEvent | React.KeyboardEvent): string {
  if (e.key === ',' || e.code === 'Comma') return ',';
  if (e.key === '`' || e.code === 'Backquote') return '`';
  const letter = e.code.match(/^Key([A-Z])$/);
  if (letter) return letter[1];
  const digit = e.code.match(/^Digit([0-9])$/);
  if (digit) return digit[1];
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
