import { useStore } from '../store/useStore';
import type { KeyValue } from '../types';
import { t } from '../i18n';
import { EnvVarField } from './EnvVarField';
import KvTableWrap, { KvTableColGroup } from './KvTableWrap';

export default function ParamsTab() {
  const updateParam = useStore((s) => s.updateParam);
  const removeParam = useStore((s) => s.removeParam);
  const syncUrlFromParams = useStore((s) => s.syncUrlFromParams);
  const params = useStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.request.params ?? []);

  const handleChange = (index: number, field: 'key' | 'value', val: string) => {
    updateParam(index, field, val);
  };

  const handleBlur = () => {
    syncUrlFromParams();
  };

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
          {params.map((p: KeyValue, i: number) => (
            <tr key={i}>
              <td className="kv-table-checkbox-cell"><input type="checkbox" checked={p.enabled} onChange={e => updateParam(i, 'enabled', e.target.checked)} /></td>
              <td>
                <EnvVarField
                  type="text"
                  placeholder={t('kv.key')}
                  value={p.key}
                  onValueChange={(val) => handleChange(i, 'key', val)}
                  onBlur={handleBlur}
                />
              </td>
              <td>
                <EnvVarField
                  type="text"
                  placeholder={t('kv.value')}
                  value={p.value}
                  onValueChange={(val) => handleChange(i, 'value', val)}
                  onBlur={handleBlur}
                />
              </td>
              <td><button className="remove-btn" onClick={() => removeParam(i)} title={t('kv.remove')}>×</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </KvTableWrap>
  );
}
