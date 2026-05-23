import { t } from '../i18n';
import { useEnvironmentStore } from '../store/useEnvironmentStore';

export default function RequestEnvToolbar() {
  const environments = useEnvironmentStore((s) => s.environments);
  const activeEnvironmentId = useEnvironmentStore((s) => s.activeEnvironmentId);
  const setActiveEnvironmentId = useEnvironmentStore((s) => s.setActiveEnvironmentId);
  const setEnvModalOpen = useEnvironmentStore((s) => s.setEnvModalOpen);

  return (
    <div className="request-env-toolbar" title={t('env.quickHint')}>
      <select
        className="request-env-select"
        value={activeEnvironmentId}
        onChange={(e) => setActiveEnvironmentId(e.target.value)}
        aria-label={t('env.active')}
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
