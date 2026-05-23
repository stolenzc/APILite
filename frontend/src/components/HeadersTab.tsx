import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../store/useStore';
import type { KeyValue } from '../types';
import { matchHeaders } from '../constants';
import { t } from '../i18n';
import { EnvVarField } from './EnvVarField';
import { useDropdownAnchorStyle } from '../hooks/useDropdownAnchorStyle';

export default function HeadersTab() {
  const { updateHeader, removeHeader } = useStore();
  const headers = useStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.request.headers ?? []);
  const [activeDropdown, setActiveDropdown] = useState<number | null>(null);
  const [envSuggestRow, setEnvSuggestRow] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLTableCellElement>(null);

  const showHeaderSuggest = activeDropdown !== null && envSuggestRow !== activeDropdown;

  const suggestions = activeDropdown !== null
    ? matchHeaders(headers[activeDropdown]?.key ?? '')
    : [];

  const dropdownStyle = useDropdownAnchorStyle(showHeaderSuggest && suggestions.length > 0, anchorRef);

  const handleSelect = (index: number, key: string) => {
    updateHeader(index, 'key', key);
    setActiveDropdown(null);
    setActiveIndex(0);
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (activeDropdown === null) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && suggestions[activeIndex]) {
      e.preventDefault();
      handleSelect(index, suggestions[activeIndex].key);
    } else if (e.key === 'Escape') {
      setActiveDropdown(null);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (dropdownRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      setActiveDropdown(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setActiveIndex(0);
  }, [activeDropdown, suggestions.length]);

  const headerSuggestPortal = showHeaderSuggest && suggestions.length > 0 && dropdownStyle
    ? createPortal(
        <div
          ref={dropdownRef}
          className="autocomplete-dropdown autocomplete-dropdown--float"
          style={dropdownStyle}
          role="listbox"
        >
          {suggestions.map((s, si) => (
            <div
              key={s.key}
              role="option"
              aria-selected={si === activeIndex}
              className={`autocomplete-item ${si === activeIndex ? 'active' : ''}`}
              onMouseDown={() => activeDropdown !== null && handleSelect(activeDropdown, s.key)}
            >
              <span className="key">{s.key}</span>
              <span className="desc">{s.description}</span>
            </div>
          ))}
        </div>,
        document.body,
      )
    : null;

  return (
    <div className="kv-table-wrap">
      <table className="kv-table">
        <thead>
          <tr>
            <th style={{ width: 44 }}></th>
            <th>{t('kv.key')}</th>
            <th>{t('kv.value')}</th>
            <th style={{ width: 30 }}></th>
          </tr>
        </thead>
        <tbody>
          {headers.map((h: KeyValue, i: number) => (
            <tr key={i}>
              <td className="kv-table-checkbox-cell"><input type="checkbox" checked={h.enabled} onChange={e => updateHeader(i, 'enabled', e.target.checked)} /></td>
              <td
                ref={activeDropdown === i ? anchorRef : undefined}
                className="autocomplete-wrapper"
              >
                <EnvVarField
                  type="text"
                  placeholder={t('kv.key')}
                  value={h.key}
                  onValueChange={(val) => {
                    updateHeader(i, 'key', val);
                    if (envSuggestRow !== i) setActiveDropdown(i);
                  }}
                  onSuggestOpenChange={(open) => {
                    if (open) setEnvSuggestRow(i);
                    else if (envSuggestRow === i) setEnvSuggestRow(null);
                  }}
                  onFocus={() => {
                    if (envSuggestRow !== i) setActiveDropdown(i);
                  }}
                  onKeyDown={(e) => handleKeyDown(e, i)}
                />
              </td>
              <td>
                <EnvVarField
                  type="text"
                  placeholder={t('kv.value')}
                  value={h.value}
                  onValueChange={(val) => updateHeader(i, 'value', val)}
                />
              </td>
              <td><button className="remove-btn" onClick={() => removeHeader(i)} title={t('kv.remove')}>×</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {headerSuggestPortal}
    </div>
  );
}
