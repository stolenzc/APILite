import { t } from '../i18n';
import { useEnvironmentStore } from '../store/useEnvironmentStore';

export default function RequestEnvToolbar() {
  const environments = useEnvironmentStore((s) => s.environments);
  const activeEnvironmentId = useEnvironmentStore((s) => s.activeEnvironmentId);
  const setActiveEnvironmentId = useEnvironmentStore((s) => s.setActiveEnvironmentId);
  const setEnvModalOpen = useEnvironmentStore((s) => s.setEnvModalOpen);

  return (
    <div className="request-env-toolbar">
      <span className="request-env-toolbar-label" title={t('env.quickHint')}>
        {t('env.active')}
      </span>
      <select
        className="raw-type-select"
        style={{ minWidth: 140 }}
        value={activeEnvironmentId}
        onChange={(e) => setActiveEnvironmentId(e.target.value)}
      >
        {environments.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name.trim() ? e.name : t('env.unnamed')}
          </option>
        ))}
      </select>
      <button type="button" className="btn btn-secondary request-env-manage" onClick={() => setEnvModalOpen(true)}>
        {t('env.manage')}
      </button>
    </div>
  );
}
