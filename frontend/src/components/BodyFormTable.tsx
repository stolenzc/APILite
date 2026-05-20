import { useRef } from 'react';
import type { FormField, FormFieldType, KeyValue } from '../types';
import { t } from '../i18n';
import { EnvVarField } from './EnvVarField';
import { pickFilePath, readBrowserFileAsBase64 } from '../utils/filePicker';
import { isTauri } from '../tauri/setupMenu';

type UrlEncodedMode = {
  mode: 'urlencoded';
  fields: KeyValue[];
  onUpdate: (index: number, field: 'key' | 'value' | 'enabled', val: string | boolean) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
};

type FormDataMode = {
  mode: 'form-data';
  fields: FormField[];
  onUpdate: (index: number, field: 'key' | 'value' | 'enabled', val: string | boolean) => void;
  onSetFieldType: (index: number, fieldType: FormFieldType) => void;
  onSetFile: (
    index: number,
    file: { fileName: string; filePath?: string; fileDataBase64?: string; value?: string },
  ) => void;
  onClearFile: (index: number) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
};

type Props = UrlEncodedMode | FormDataMode;

export default function BodyFormTable(props: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingFileIndex = useRef<number | null>(null);

  const pickFileForRow = async (index: number) => {
    if (props.mode !== 'form-data') return;
    if (isTauri()) {
      const path = await pickFilePath();
      if (!path) return;
      const fileName = path.split(/[/\\]/).pop() || 'file';
      props.onSetFile(index, { fileName, filePath: path, value: path });
      return;
    }
    pendingFileIndex.current = index;
    fileInputRef.current?.click();
  };

  const onBrowserFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (props.mode !== 'form-data') return;
    const index = pendingFileIndex.current;
    const file = e.target.files?.[0];
    e.target.value = '';
    pendingFileIndex.current = null;
    if (index == null || !file) return;
    try {
      const { fileName, fileDataBase64 } = await readBrowserFileAsBase64(file);
      props.onSetFile(index, { fileName, fileDataBase64, value: fileName });
    } catch (err) {
      console.error('Failed to read file:', err);
    }
  };

  const isFormData = props.mode === 'form-data';

  return (
    <div className="body-form-table-wrap">
      <input
        ref={fileInputRef}
        type="file"
        hidden
        onChange={onBrowserFileChange}
      />
      <table className="kv-table body-form-table">
        <thead>
          <tr>
            <th style={{ width: 30 }} />
            <th>{t('kv.key')}</th>
            {isFormData && <th style={{ width: 100 }}>{t('body.fieldType')}</th>}
            <th>{isFormData ? t('body.fieldValue') : t('kv.value')}</th>
            <th style={{ width: 30 }} />
          </tr>
        </thead>
        <tbody>
          {props.fields.map((row, i) => {
            const isFile = isFormData && (row as FormField).fieldType === 'file';
            const fileName = isFormData ? (row as FormField).fileName : undefined;
            return (
              <tr key={i}>
                <td>
                  <input
                    type="checkbox"
                    checked={row.enabled}
                    onChange={(e) => props.onUpdate(i, 'enabled', e.target.checked)}
                  />
                </td>
                <td>
                  <EnvVarField
                    type="text"
                    placeholder={t('kv.key')}
                    value={row.key}
                    onValueChange={(val) => props.onUpdate(i, 'key', val)}
                  />
                </td>
                {isFormData && (
                  <td>
                    <select
                      className="body-field-type-select"
                      value={(row as FormField).fieldType}
                      onChange={(e) =>
                        props.onSetFieldType(i, e.target.value as FormFieldType)
                      }
                    >
                      <option value="text">{t('body.fieldType.text')}</option>
                      <option value="file">{t('body.fieldType.file')}</option>
                    </select>
                  </td>
                )}
                <td>
                  {isFile ? (
                    <div className="body-file-cell">
                      <span className="body-file-name" title={fileName || row.value}>
                        {fileName || row.value || t('body.noFile')}
                      </span>
                      <button
                        type="button"
                        className="btn btn-secondary body-file-btn"
                        onClick={() => void pickFileForRow(i)}
                      >
                        {t('body.selectFile')}
                      </button>
                      {(fileName || row.value) && (
                        <button
                          type="button"
                          className="remove-btn"
                          title={t('body.clearFile')}
                          onClick={() => props.onClearFile(i)}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ) : (
                    <EnvVarField
                      type="text"
                      placeholder={t('kv.value')}
                      value={row.value}
                      onValueChange={(val) => props.onUpdate(i, 'value', val)}
                    />
                  )}
                </td>
                <td>
                  <button
                    type="button"
                    className="remove-btn"
                    onClick={() => props.onRemove(i)}
                    title={t('kv.remove')}
                  >
                    ×
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="add-row">
        <button type="button" className="add-row-btn" onClick={props.onAdd}>
          {isFormData ? t('body.addFormField') : t('body.addUrlEncodedField')}
        </button>
      </div>
    </div>
  );
}
