import { useCallback, useEffect, useState, type RefObject } from 'react';
import type { EditorKeyEvent } from '../utils/keyboard';
import type { EditorView } from '@codemirror/view';
import { parseOpenEnvPlaceholder } from '../utils/envInterpolation';
import { isImeComposing } from '../utils/keyboard';
import { useStore } from '../store/useStore';
import { useEnvVarEntries, type EnvSuggestRow } from './useEnvVarEntries';

export type EnvSuggestState = {
  innerStart: number;
  innerEnd: number;
  list: EnvSuggestRow[];
};

export function useEnvVarCodeMirrorSuggest(
  value: string,
  onValueChange: (next: string) => void,
  viewRef: RefObject<EditorView | null>,
) {
  const envVarEntries = useEnvVarEntries();
  const activeTabId = useStore((s) => s.activeTabId);
  const [envSuggest, setEnvSuggest] = useState<EnvSuggestState | null>(null);
  const [envSuggestIndex, setEnvSuggestIndex] = useState(0);
  const [caretIndex, setCaretIndex] = useState(0);

  useEffect(() => {
    setEnvSuggest(null);
  }, [activeTabId]);

  const syncEnvSuggest = useCallback(
    (text: string, cursor: number) => {
      setCaretIndex(cursor);
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
      const pos = innerStart + name.length + 2;
      onValueChange(next);
      setEnvSuggest(null);
      queueMicrotask(() => {
        const view = viewRef.current;
        if (!view) return;
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: next },
          selection: { anchor: pos, head: pos },
        });
        view.focus();
        setCaretIndex(pos);
      });
    },
    [envSuggest, value, onValueChange, viewRef],
  );

  const handleEnvKeyDown = useCallback(
    (e: EditorKeyEvent): boolean => {
      if (isImeComposing(e)) return false;
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

  const isOpen = !!(envSuggest && envSuggest.list.length > 0);

  return {
    envSuggest,
    envSuggestIndex,
    setEnvSuggestIndex,
    applyEnvSuggestion,
    handleEnvKeyDown,
    syncEnvSuggest,
    isOpen,
    caretIndex,
    closeSuggest: () => setEnvSuggest(null),
  };
}
