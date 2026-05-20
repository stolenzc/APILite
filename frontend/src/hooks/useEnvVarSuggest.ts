import { useState, useCallback, useEffect, type RefObject } from 'react';
import { parseOpenEnvPlaceholder } from '../utils/envInterpolation';
import { useStore } from '../store/useStore';
import { useEnvVarEntries, type EnvSuggestRow } from './useEnvVarEntries';

export type EnvSuggestState = {
  innerStart: number;
  innerEnd: number;
  list: EnvSuggestRow[];
};

export function useEnvVarSuggest(
  value: string,
  onValueChange: (next: string) => void,
  inputRef: RefObject<HTMLInputElement | HTMLTextAreaElement | null>,
) {
  const envVarEntries = useEnvVarEntries();
  const activeTabId = useStore((s) => s.activeTabId);
  const [envSuggest, setEnvSuggest] = useState<EnvSuggestState | null>(null);
  const [envSuggestIndex, setEnvSuggestIndex] = useState(0);

  useEffect(() => {
    setEnvSuggest(null);
  }, [activeTabId]);

  const syncEnvSuggest = useCallback(
    (text: string, cursor: number) => {
      const open = parseOpenEnvPlaceholder(text, cursor);
      if (!open) {
        setEnvSuggest(null);
        return false;
      }
      const pf = open.partialRaw.trim().toLowerCase();
      const list = envVarEntries.filter(({ name }) => {
        if (!pf) return true;
        return name.toLowerCase().includes(pf);
      });
      if (list.length === 0) {
        setEnvSuggest(null);
        return false;
      }
      setEnvSuggest({ innerStart: open.innerStart, innerEnd: open.innerEnd, list });
      setEnvSuggestIndex(0);
      return true;
    },
    [envVarEntries],
  );

  const applyEnvSuggestion = useCallback(
    (name: string) => {
      if (!envSuggest) return;
      const { innerStart, innerEnd } = envSuggest;
      const next = value.slice(0, innerStart) + name + '}}' + value.slice(innerEnd);
      onValueChange(next);
      setEnvSuggest(null);
      queueMicrotask(() => {
        const el = inputRef.current;
        if (!el) return;
        el.focus();
        const pos = innerStart + name.length + 2;
        el.setSelectionRange(pos, pos);
      });
    },
    [envSuggest, value, onValueChange, inputRef],
  );

  const handleEnvKeyDown = useCallback(
    (e: React.KeyboardEvent): boolean => {
      if (!envSuggest || envSuggest.list.length === 0) return false;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setEnvSuggestIndex((i) => (i + 1) % envSuggest.list.length);
        return true;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setEnvSuggestIndex((i) => (i - 1 + envSuggest.list.length) % envSuggest.list.length);
        return true;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setEnvSuggest(null);
        return true;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        applyEnvSuggestion(envSuggest.list[envSuggestIndex]!.name);
        return true;
      }
      return false;
    },
    [envSuggest, envSuggestIndex, applyEnvSuggestion],
  );

  const onChangeWithSuggest = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const text = e.target.value;
      const pos = e.target.selectionStart ?? text.length;
      onValueChange(text);
      syncEnvSuggest(text, pos);
    },
    [onValueChange, syncEnvSuggest],
  );

  const envInputHandlers = {
    onSelect: (e: React.SyntheticEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const el = e.currentTarget;
      syncEnvSuggest(el.value, el.selectionStart ?? el.value.length);
    },
    onClick: (e: React.MouseEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const el = e.currentTarget;
      syncEnvSuggest(el.value, el.selectionStart ?? el.value.length);
    },
    onBlur: () => {
      window.setTimeout(() => setEnvSuggest(null), 120);
    },
  };

  const isOpen = !!(envSuggest && envSuggest.list.length > 0);

  return {
    envSuggest,
    envSuggestIndex,
    setEnvSuggestIndex,
    applyEnvSuggestion,
    handleEnvKeyDown,
    syncEnvSuggest,
    onChangeWithSuggest,
    envInputHandlers,
    isOpen,
  };
}
