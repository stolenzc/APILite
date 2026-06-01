export interface ThemeColors {
  '--bg-primary': string;
  '--bg-secondary': string;
  '--bg-tertiary': string;
  '--bg-input': string;
  '--border-color': string;
  '--text-primary': string;
  '--text-secondary': string;
  '--text-muted': string;
  '--accent': string;
  '--accent-hover': string;
  '--success': string;
  '--warning': string;
  '--error': string;
  '--syntax-keyword': string;
  '--syntax-property': string;
  '--syntax-string': string;
  '--syntax-number': string;
  '--syntax-bool': string;
  '--syntax-comment': string;
  '--syntax-bracket': string;
  '--syntax-def': string;
}

const syntax = {
  dark: {
    '--syntax-keyword': '#56b6c2',
    '--syntax-property': '#e06c75',
    '--syntax-string': '#98c379',
    '--syntax-number': '#d19a66',
    '--syntax-bool': '#56b6c2',
    '--syntax-comment': '#6a6a7a',
    '--syntax-bracket': '#a0a0b0',
    '--syntax-def': '#61afef',
  },
  light: {
    '--syntax-keyword': '#0550ae',
    '--syntax-property': '#953800',
    '--syntax-string': '#0a3069',
    '--syntax-number': '#0550ae',
    '--syntax-bool': '#0550ae',
    '--syntax-comment': '#6e7781',
    '--syntax-bracket': '#57606a',
    '--syntax-def': '#8250df',
  },
  nord: {
    '--syntax-keyword': '#81a1c1',
    '--syntax-property': '#8fbcbb',
    '--syntax-string': '#a3be8c',
    '--syntax-number': '#b48ead',
    '--syntax-bool': '#81a1c1',
    '--syntax-comment': '#616e88',
    '--syntax-bracket': '#d8dee9',
    '--syntax-def': '#88c0d0',
  },
  solarized: {
    '--syntax-keyword': '#268bd2',
    '--syntax-property': '#2aa198',
    '--syntax-string': '#859900',
    '--syntax-number': '#d33682',
    '--syntax-bool': '#268bd2',
    '--syntax-comment': '#586e75',
    '--syntax-bracket': '#839496',
    '--syntax-def': '#b58900',
  },
  monokai: {
    '--syntax-keyword': '#f92672',
    '--syntax-property': '#a6e22e',
    '--syntax-string': '#e6db74',
    '--syntax-number': '#ae81ff',
    '--syntax-bool': '#66d9ef',
    '--syntax-comment': '#75715e',
    '--syntax-bracket': '#f8f8f2',
    '--syntax-def': '#66d9ef',
  },
} as const;

export const themes: Record<string, { label: string; colors: ThemeColors }> = {
  dark: {
    label: 'Dark',
    colors: {
      '--bg-primary': '#1a1a2e',
      '--bg-secondary': '#16213e',
      '--bg-tertiary': '#0f3460',
      '--bg-input': '#1e2a4a',
      '--border-color': '#2a3a5e',
      '--text-primary': '#e0e0e0',
      '--text-secondary': '#a0a0b0',
      '--text-muted': '#6a6a7a',
      '--accent': '#e94560',
      '--accent-hover': '#ff6b81',
      '--success': '#00c853',
      '--warning': '#ffd600',
      '--error': '#ff1744',
      ...syntax.dark,
    },
  },
  light: {
    label: 'Light',
    colors: {
      '--bg-primary': '#f5f5f5',
      '--bg-secondary': '#ffffff',
      '--bg-tertiary': '#e8e8e8',
      '--bg-input': '#f0f0f0',
      '--border-color': '#d0d0d0',
      '--text-primary': '#333333',
      '--text-secondary': '#666666',
      '--text-muted': '#999999',
      '--accent': '#e94560',
      '--accent-hover': '#c73050',
      '--success': '#00a844',
      '--warning': '#cc9900',
      '--error': '#cc0033',
      ...syntax.light,
    },
  },
  nord: {
    label: 'Nord',
    colors: {
      '--bg-primary': '#2e3440',
      '--bg-secondary': '#3b4252',
      '--bg-tertiary': '#434c5e',
      '--bg-input': '#4c566a',
      '--border-color': '#4c566a',
      '--text-primary': '#eceff4',
      '--text-secondary': '#d8dee9',
      '--text-muted': '#7b88a1',
      '--accent': '#88c0d0',
      '--accent-hover': '#8fbcbb',
      '--success': '#a3be8c',
      '--warning': '#ebcb8b',
      '--error': '#bf616a',
      ...syntax.nord,
    },
  },
  solarized: {
    label: 'Solarized Dark',
    colors: {
      '--bg-primary': '#002b36',
      '--bg-secondary': '#073642',
      '--bg-tertiary': '#586e75',
      '--bg-input': '#0a4050',
      '--border-color': '#586e75',
      '--text-primary': '#93a1a1',
      '--text-secondary': '#839496',
      '--text-muted': '#586e75',
      '--accent': '#268bd2',
      '--accent-hover': '#2aa198',
      '--success': '#859900',
      '--warning': '#b58900',
      '--error': '#dc322f',
      ...syntax.solarized,
    },
  },
  monokai: {
    label: 'Monokai',
    colors: {
      '--bg-primary': '#272822',
      '--bg-secondary': '#3e3d32',
      '--bg-tertiary': '#49483e',
      '--bg-input': '#3e3d32',
      '--border-color': '#49483e',
      '--text-primary': '#f8f8f2',
      '--text-secondary': '#e6db74',
      '--text-muted': '#75715e',
      '--accent': '#f92672',
      '--accent-hover': '#ff6b81',
      '--success': '#a6e22e',
      '--warning': '#e6db74',
      '--error': '#f92672',
      ...syntax.monokai,
    },
  },
};

export function applyTheme(name: string) {
  const theme = themes[name];
  if (!theme) return;
  const root = document.documentElement;
  for (const [key, value] of Object.entries(theme.colors)) {
    root.style.setProperty(key, value);
  }
}
