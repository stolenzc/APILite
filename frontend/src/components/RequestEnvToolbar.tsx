import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { t } from '../i18n';
import { useDropdownAnchorStyle } from '../hooks/useDropdownAnchorStyle';
import { useEnvironmentStore } from '../store/useEnvironmentStore';
import { useSettingsStore } from '../store/useSettings';
import { focusEnvironmentSelect } from '../utils/focusEnvironmentSelect';
import { isImeComposing } from '../utils/keyboard';

function envLabel(name: string): string {
  return name.trim() ? name : t('env.unnamed');
}

export default function RequestEnvToolbar() {
  const environments = useEnvironmentStore((s) => s.environments);
  const activeEnvironmentId = useEnvironmentStore((s) => s.activeEnvironmentId);
  const setActiveEnvironmentId = useEnvironmentStore((s) => s.setActiveEnvironmentId);
  const setEnvModalOpen = useEnvironmentStore((s) => s.setEnvModalOpen);
  const focusEnvironment = useSettingsStore((s) => s.shortcuts.focusEnvironment);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const dropdownStyle = useDropdownAnchorStyle(open, triggerRef, {
    placement: 'below',
    matchAnchorWidth: true,
  });

  const activeEnv = environments.find((env) => env.id === activeEnvironmentId);

  useEffect(() => {
    const onFocus = () => focusEnvironmentSelect();
    window.addEventListener('app:focus-environment', onFocus);
    return () => window.removeEventListener('app:focus-environment', onFocus);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const cycleEnvironment = useCallback(
    (direction: 1 | -1) => {
      const count = environments.length;
      if (count === 0) return;
      const idx = environments.findIndex((env) => env.id === activeEnvironmentId);
      const base = idx === -1 ? 0 : idx;
      const next = environments[(base + direction + count) % count];
      setActiveEnvironmentId(next.id);
    },
    [environments, activeEnvironmentId, setActiveEnvironmentId],
  );

  const closeDropdown = useCallback(() => {
    setOpen(false);
    triggerRef.current?.blur();
  }, []);

  const handleTriggerKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (isImeComposing(e)) return;
      if (environments.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (open) setOpen(false);
        cycleEnvironment(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (open) setOpen(false);
        cycleEnvironment(-1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (open) closeDropdown();
        else setOpen(true);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeDropdown();
      }
    },
    [environments.length, cycleEnvironment, open, closeDropdown],
  );

  const hint = `${t('env.quickHint')} · ↑↓ ${t('env.cycleHint')} · ${focusEnvironment}`;

  const dropdown =
    open && dropdownStyle && environments.length > 0
      ? createPortal(
          <div
            ref={dropdownRef}
            className="request-env-dropdown request-env-dropdown--float"
            style={dropdownStyle}
            role="listbox"
            aria-label={t('env.active')}
          >
            {environments.map((env) => {
              const selected = env.id === activeEnvironmentId;
              return (
                <button
                  key={env.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={`request-env-dropdown-item${selected ? ' request-env-dropdown-item--selected' : ''}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setActiveEnvironmentId(env.id);
                    closeDropdown();
                  }}
                >
                  {envLabel(env.name)}
                </button>
              );
            })}
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="request-env-toolbar" title={hint}>
      <button
        ref={triggerRef}
        type="button"
        className="request-env-select"
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        onKeyDown={handleTriggerKeyDown}
        aria-label={t('env.active')}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={environments.length === 0}
        title={hint}
      >
        {activeEnv ? envLabel(activeEnv.name) : t('env.unnamed')}
      </button>
      <button
        type="button"
        className="btn btn-icon request-env-settings"
        onClick={() => setEnvModalOpen(true)}
        title={t('env.manage')}
        aria-label={t('env.manage')}
      >
        ⚙
      </button>
      {dropdown}
    </div>
  );
}
