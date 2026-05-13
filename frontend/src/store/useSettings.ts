import { create } from 'zustand';
import type { Locale, defaultLocale } from '../i18n';

export interface ShortcutConfig {
  sendRequest: string;
  saveRequest: string;
  importCurl: string;
  exportCurl: string;
  focusUrl: string;
  toggleSettings: string;
}

export const defaultShortcuts: ShortcutConfig = {
  sendRequest: 'Ctrl+Enter',
  saveRequest: 'Ctrl+S',
  importCurl: 'Ctrl+Shift+I',
  exportCurl: 'Ctrl+Shift+E',
  focusUrl: 'Ctrl+L',
  toggleSettings: 'Ctrl+,',
};

export interface AppSettings {
  theme: string;
  locale: Locale;
  shortcuts: ShortcutConfig;
  responseHeight: number;
}

export const defaultSettings: AppSettings = {
  theme: 'dark',
  locale: 'en',
  shortcuts: { ...defaultShortcuts },
  responseHeight: 300,
};

function loadSettings(): AppSettings {
  try {
    const stored = localStorage.getItem('postlite-settings');
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return { ...defaultSettings };
}

function saveSettings(settings: AppSettings) {
  try {
    localStorage.setItem('postlite-settings', JSON.stringify(settings));
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
}

export const useSettingsStore = create<SettingsState>((set) => {
  const initial = loadSettings();
  return {
    ...initial,
    settingsOpen: false,

    setSettingsOpen: (settingsOpen) => set({ settingsOpen }),

    setTheme: (theme) => set(state => {
      const next = { ...state, theme };
      saveSettings(next);
      return next;
    }),

    setLocale: (locale) => set(state => {
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
      return { ...defaultSettings, settingsOpen: true };
    }),

    setResponseHeight: (responseHeight) => set(state => {
      const next = { ...state, responseHeight };
      saveSettings(next);
      return next;
    }),
  };
});

// Keyboard shortcut dispatcher
export function initKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    const shortcuts = useSettingsStore.getState().shortcuts;
    const combo = buildCombo(e);

    if (combo === shortcuts.sendRequest) {
      e.preventDefault();
      const sendBtn = document.querySelector('.btn-send') as HTMLElement | null;
      sendBtn?.click();
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
  });
}

function buildCombo(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey) parts.push('Ctrl');
  if (e.metaKey) parts.push('Meta');
  if (e.shiftKey) parts.push('Shift');
  if (e.altKey) parts.push('Alt');

  const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
  if (key !== 'Control' && key !== 'Meta' && key !== 'Shift' && key !== 'Alt') {
    parts.push(key);
  }

  return parts.join('+');
}
