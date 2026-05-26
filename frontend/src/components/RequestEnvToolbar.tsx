import { useCallback, useEffect, useRef } from 'react';
import { t } from '../i18n';
import { useEnvironmentStore } from '../store/useEnvironmentStore';
import { useSettingsStore } from '../store/useSettings';
import { focusEnvironmentSelect } from '../utils/focusEnvironmentSelect';
import { isImeComposing } from '../utils/keyboard';

export default function RequestEnvToolbar() {
  const environments = useEnvironmentStore((s) => s.environments);
  const activeEnvironmentId = useEnvironmentStore((s) => s.activeEnvironmentId);
  const setActiveEnvironmentId = useEnvironmentStore((s) => s.setActiveEnvironmentId);
  const setEnvModalOpen = useEnvironmentStore((s) => s.setEnvModalOpen);
  const focusEnvironment = useSettingsStore((s) => s.shortcuts.focusEnvironment);
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    const onFocus = () => focusEnvironmentSelect();
    window.addEventListener('app:focus-environment', onFocus);
    return () => window.removeEventListener('app:focus-environment', onFocus);
  }, []);

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

  const handleSelectKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLSelectElement>) => {
      if (isImeComposing(e)) return;
      if (environments.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        cycleEnvironment(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        cycleEnvironment(-1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        selectRef.current?.blur();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        selectRef.current?.blur();
      }
    },
    [environments.length, cycleEnvironment],
  );

  const hint = `${t('env.quickHint')} · ↑↓ ${t('env.cycleHint')} · ${focusEnvironment}`;

  return (
    <div className="request-env-toolbar" title={hint}>
      <select
        ref={selectRef}
        className="request-env-select"
        value={activeEnvironmentId}
        onChange={(e) => setActiveEnvironmentId(e.target.value)}
        onKeyDown={handleSelectKeyDown}
        aria-label={t('env.active')}
        title={hint}
      >
        {environments.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name.trim() ? e.name : t('env.unnamed')}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="btn btn-icon request-env-settings"
        onClick={() => setEnvModalOpen(true)}
        title={t('env.manage')}
        aria-label={t('env.manage')}
      >
        ⚙
      </button>
    </div>
  );
}
