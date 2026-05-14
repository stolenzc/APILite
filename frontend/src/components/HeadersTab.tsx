import { useState, useRef, useEffect } from 'react';
import { useStore } from '../store/useStore';
import type { KeyValue } from '../types';
import { matchHeaders } from '../constants';
import { t } from '../i18n';

export default function HeadersTab() {
  const { updateHeader, addHeader, removeHeader } = useStore();
  const headers = useStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.request.headers ?? []);
  const [activeDropdown, setActiveDropdown] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const suggestions = activeDropdown !== null
    ? matchHeaders(headers[activeDropdown]?.key ?? '')
    : [];

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
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div>
      <table className="kv-table">
        <thead>
          <tr>
            <th style={{ width: 30 }}></th>
            <th>{t('kv.key')}</th>
            <th>{t('kv.value')}</th>
            <th style={{ width: 30 }}></th>
          </tr>
        </thead>
        <tbody>
          {headers.map((h: KeyValue, i: number) => (
            <tr key={i}>
              <td><input type="checkbox" checked={h.enabled} onChange={e => updateHeader(i, 'enabled' as never, e.target.checked as never)} /></td>
              <td className="autocomplete-wrapper">
                <input
                  type="text"
                  placeholder={t('kv.key')}
                  value={h.key}
                  onChange={e => {
                    updateHeader(i, 'key', e.target.value);
                    if (e.target.value) setActiveDropdown(i);
                    setActiveIndex(0);
                  }}
                  onFocus={e => { if (e.target.value) setActiveDropdown(i); }}
                  onKeyDown={e => handleKeyDown(e, i)}
                  autoComplete="off"
                />
                {activeDropdown === i && suggestions.length > 0 && (
                  <div ref={dropdownRef} className="autocomplete-dropdown">
                    {suggestions.map((s, si) => (
                      <div
                        key={s.key}
                        className={`autocomplete-item ${si === activeIndex ? 'active' : ''}`}
                        onMouseDown={() => handleSelect(i, s.key)}
                      >
                        <span className="key">{s.key}</span>
                        <span className="desc">{s.description}</span>
                      </div>
                    ))}
                  </div>
                )}
              </td>
              <td><input type="text" placeholder={t('kv.value')} value={h.value} onChange={e => updateHeader(i, 'value', e.target.value)} /></td>
              <td><button className="remove-btn" onClick={() => removeHeader(i)} title={t('kv.remove')}>×</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="add-row">
        <button className="add-row-btn" onClick={addHeader}>{t('kv.addHeader')}</button>
      </div>
    </div>
  );
}
