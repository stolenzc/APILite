import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../store/useStore';
import type { KeyValue } from '../types';
import { matchHeaders } from '../constants';
import { matchHeaderValues } from '../utils/headerValues';
import { t } from '../i18n';
import { EnvVarField } from './EnvVarField';
import KvTableWrap, { KvTableColGroup } from './KvTableWrap';
import { useDropdownAnchorStyle } from '../hooks/useDropdownAnchorStyle';
import { isImeComposing } from '../utils/keyboard';

export default function HeadersTab() {
  const updateHeader = useStore((s) => s.updateHeader);
  const removeHeader = useStore((s) => s.removeHeader);
  const headers = useStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.request.headers ?? []);
  const [activeKeyRow, setActiveKeyRow] = useState<number | null>(null);
  const [activeValueRow, setActiveValueRow] = useState<number | null>(null);
  const [envSuggestRow, setEnvSuggestRow] = useState<number | null>(null);
  const [keyActiveIndex, setKeyActiveIndex] = useState(0);
  const [valueActiveIndex, setValueActiveIndex] = useState(0);
  const keyDropdownRef = useRef<HTMLDivElement>(null);
  const valueDropdownRef = useRef<HTMLDivElement>(null);
  const keyAnchorRef = useRef<HTMLTableCellElement>(null);
  const valueAnchorRef = useRef<HTMLTableCellElement>(null);

  const keySuggestions =
    activeKeyRow !== null ? matchHeaders(headers[activeKeyRow]?.key ?? '') : [];

  const valueSuggestions =
    activeValueRow !== null
      ? matchHeaderValues(headers[activeValueRow]?.key ?? '', headers[activeValueRow]?.value ?? '')
      : [];

  const showKeySuggest = activeKeyRow !== null && envSuggestRow !== activeKeyRow;
  const showValueSuggest = activeValueRow !== null && envSuggestRow !== activeValueRow;

  const keyDropdownStyle = useDropdownAnchorStyle(
    showKeySuggest && keySuggestions.length > 0,
    keyAnchorRef,
  );
  const valueDropdownStyle = useDropdownAnchorStyle(
    showValueSuggest && valueSuggestions.length > 0,
    valueAnchorRef,
  );

  const handleKeySelect = (index: number, key: string) => {
    updateHeader(index, 'key', key);
    setActiveKeyRow(null);
    setKeyActiveIndex(0);
  };

  const handleValueSelect = (index: number, value: string) => {
    updateHeader(index, 'value', value);
    setActiveValueRow(null);
    setValueActiveIndex(0);
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (isImeComposing(e)) return;
    if (activeKeyRow === null) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setKeyActiveIndex((prev) => Math.min(prev + 1, keySuggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setKeyActiveIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && keySuggestions[keyActiveIndex]) {
      e.preventDefault();
      handleKeySelect(index, keySuggestions[keyActiveIndex].key);
    } else if (e.key === 'Escape') {
      setActiveKeyRow(null);
    }
  };

  const handleValueKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (isImeComposing(e)) return;
    if (activeValueRow === null) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setValueActiveIndex((prev) => Math.min(prev + 1, valueSuggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setValueActiveIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && valueSuggestions[valueActiveIndex]) {
      e.preventDefault();
      handleValueSelect(index, valueSuggestions[valueActiveIndex].value);
    } else if (e.key === 'Escape') {
      setActiveValueRow(null);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (keyDropdownRef.current?.contains(target)) return;
      if (valueDropdownRef.current?.contains(target)) return;
      if (keyAnchorRef.current?.contains(target)) return;
      if (valueAnchorRef.current?.contains(target)) return;
      setActiveKeyRow(null);
      setActiveValueRow(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setKeyActiveIndex(0);
  }, [activeKeyRow, keySuggestions.length]);

  useEffect(() => {
    setValueActiveIndex(0);
  }, [activeValueRow, valueSuggestions.length]);

  const keySuggestPortal =
    showKeySuggest && keySuggestions.length > 0 && keyDropdownStyle
      ? createPortal(
          <div
            ref={keyDropdownRef}
            className="autocomplete-dropdown autocomplete-dropdown--float"
            style={keyDropdownStyle}
            role="listbox"
          >
            {keySuggestions.map((s, si) => (
              <div
                key={s.key}
                role="option"
                aria-selected={si === keyActiveIndex}
                className={`autocomplete-item ${si === keyActiveIndex ? 'active' : ''}`}
                onMouseDown={() => activeKeyRow !== null && handleKeySelect(activeKeyRow, s.key)}
              >
                <span className="key">{s.key}</span>
                <span className="desc">{s.description}</span>
              </div>
            ))}
          </div>,
          document.body,
        )
      : null;

  const valueSuggestPortal =
    showValueSuggest && valueSuggestions.length > 0 && valueDropdownStyle
      ? createPortal(
          <div
            ref={valueDropdownRef}
            className="autocomplete-dropdown autocomplete-dropdown--float"
            style={valueDropdownStyle}
            role="listbox"
          >
            {valueSuggestions.map((s, si) => (
              <div
                key={`${s.value}-${si}`}
                role="option"
                aria-selected={si === valueActiveIndex}
                className={`autocomplete-item ${si === valueActiveIndex ? 'active' : ''}`}
                onMouseDown={() =>
                  activeValueRow !== null && handleValueSelect(activeValueRow, s.value)
                }
              >
                <span className="key">{s.value}</span>
                {s.description ? <span className="desc">{s.description}</span> : null}
              </div>
            ))}
          </div>,
          document.body,
        )
      : null;

  return (
    <KvTableWrap>
      <table className="kv-table">
        <KvTableColGroup />
        <thead>
          <tr>
            <th />
            <th>{t('kv.key')}</th>
            <th>{t('kv.value')}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {headers.map((h: KeyValue, i: number) => (
            <tr key={i}>
              <td className="kv-table-checkbox-cell">
                <input
                  type="checkbox"
                  checked={h.enabled}
                  onChange={(e) => updateHeader(i, 'enabled', e.target.checked)}
                />
              </td>
              <td
                ref={activeKeyRow === i ? keyAnchorRef : undefined}
                className="autocomplete-wrapper"
              >
                <EnvVarField
                  type="text"
                  placeholder={t('kv.key')}
                  value={h.key}
                  onValueChange={(val) => {
                    updateHeader(i, 'key', val);
                    if (envSuggestRow !== i) setActiveKeyRow(i);
                  }}
                  onSuggestOpenChange={(open) => {
                    if (open) setEnvSuggestRow(i);
                    else if (envSuggestRow === i) setEnvSuggestRow(null);
                  }}
                  onFocus={() => {
                    setActiveValueRow(null);
                    if (envSuggestRow !== i) setActiveKeyRow(i);
                  }}
                  onKeyDown={(e) => handleKeyDown(e, i)}
                />
              </td>
              <td
                ref={activeValueRow === i ? valueAnchorRef : undefined}
                className="autocomplete-wrapper"
              >
                <EnvVarField
                  type="text"
                  placeholder={t('kv.value')}
                  value={h.value}
                  onValueChange={(val) => {
                    updateHeader(i, 'value', val);
                    if (envSuggestRow !== i) setActiveValueRow(i);
                  }}
                  onSuggestOpenChange={(open) => {
                    if (open) setEnvSuggestRow(i);
                    else if (envSuggestRow === i) setEnvSuggestRow(null);
                  }}
                  onFocus={() => {
                    setActiveKeyRow(null);
                    if (envSuggestRow !== i) setActiveValueRow(i);
                  }}
                  onKeyDown={(e) => handleValueKeyDown(e, i)}
                />
              </td>
              <td>
                <button className="remove-btn" onClick={() => removeHeader(i)} title={t('kv.remove')}>
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {keySuggestPortal}
      {valueSuggestPortal}
    </KvTableWrap>
  );
}
