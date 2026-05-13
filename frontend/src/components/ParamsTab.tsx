import { useStore } from '../store/useStore';
import type { KeyValue } from '../types';
import { t } from '../i18n';

export default function ParamsTab() {
  const { request, updateParam, addParam, removeParam, syncUrlFromParams } = useStore();

  const handleChange = (index: number, field: 'key' | 'value', val: string) => {
    updateParam(index, field, val);
  };

  const handleBlur = () => {
    syncUrlFromParams();
  };

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
          {request.params.map((p: KeyValue, i: number) => (
            <tr key={i}>
              <td><input type="checkbox" checked={p.enabled} onChange={e => updateParam(i, 'enabled' as never, e.target.checked as never)} onBlur={handleBlur} /></td>
              <td><input type="text" placeholder={t('kv.key')} value={p.key} onChange={e => handleChange(i, 'key', e.target.value)} onBlur={handleBlur} /></td>
              <td><input type="text" placeholder={t('kv.value')} value={p.value} onChange={e => handleChange(i, 'value', e.target.value)} onBlur={handleBlur} /></td>
              <td><button className="remove-btn" onClick={() => removeParam(i)} title={t('kv.remove')}>×</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="add-row">
        <button className="add-row-btn" onClick={addParam}>{t('kv.addParam')}</button>
      </div>
    </div>
  );
}
