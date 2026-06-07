import { useEffect, useRef, useState } from 'react';
import type { EditorKeyEvent } from '../utils/keyboard';
import { useStore } from '../store/useStore';
import { matchesShortcutCombo, useSettingsStore } from '../store/useSettings';
import type { BodyType, RawContentType } from '../types';
import { t } from '../i18n';
import { formatJsonc, jsoncToStrictJson, normalizeToJsonText, parseJsonc } from '../utils/jsonUtils';
import CodeEditor from './CodeEditor';
import BodyFormTable from './BodyFormTable';
import { pickFilePath, readBrowserFileAsBase64 } from '../utils/filePicker';
import { isTauri } from '../tauri/setupMenu';
import { isImeComposing } from '../utils/keyboard';

function isSendRequestShortcut(e: EditorKeyEvent): boolean {
  return matchesShortcutCombo(e, useSettingsStore.getState().shortcuts.sendRequest);
}

const BODY_TYPES: { value: BodyType; label: string }[] = [
  { value: 'none', label: 'body.type.none' },
  { value: 'form-data', label: 'body.type.form-data' },
  { value: 'x-www-form-urlencoded', label: 'body.type.urlencoded' },
  { value: 'raw', label: 'body.type.raw' },
  { value: 'binary', label: 'body.type.binary' },
];

const RAW_CONTENT_TYPES: { value: RawContentType; label: string }[] = [
  { value: 'json', label: 'body.type.json' },
  { value: 'xml', label: 'body.type.xml' },
  { value: 'text', label: 'body.type.text' },
  { value: 'javascript', label: 'body.type.javascript' },
  { value: 'html', label: 'body.type.html' },
];

const PLACEHOLDER_KEYS: Record<RawContentType, string> = {
  json: 'body.placeholder.json',
  xml: 'body.placeholder.xml',
  text: 'body.placeholder.text',
  javascript: 'body.placeholder.javascript',
  html: 'body.placeholder.html',
};

function NoneBody() {
  return <div style={{ padding: '24px 16px', color: 'var(--text-muted)', fontSize: 13 }}>{t('body.noBody')}</div>;
}

function BinaryBody() {
  const binaryFile = useStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.request.binaryFile ?? null);
  const setBinaryFile = useStore((s) => s.setBinaryFile);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePick = async () => {
    if (isTauri()) {
      const path = await pickFilePath();
      if (!path) return;
      const fileName = path.split(/[/\\]/).pop() || 'file';
      setBinaryFile({ fileName, filePath: path });
      return;
    }
    fileInputRef.current?.click();
  };

  const onBrowserFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const { fileName, fileDataBase64 } = await readBrowserFileAsBase64(file);
      setBinaryFile({ fileName, fileDataBase64 });
    } catch (err) {
      console.error('Failed to read file:', err);
    }
  };

  return (
    <div className="body-binary-panel">
      <input ref={fileInputRef} type="file" hidden onChange={onBrowserFile} />
      <p className="body-binary-hint">{t('body.binaryHint')}</p>
      <div className="body-binary-row">
        <span className="body-file-name" title={binaryFile?.fileName}>
          {binaryFile?.fileName ?? t('body.noFile')}
        </span>
        <button type="button" className="btn btn-secondary body-file-btn" onClick={() => void handlePick()}>
          {t('body.selectFile')}
        </button>
        {binaryFile && (
          <button type="button" className="btn btn-secondary body-file-btn" onClick={() => setBinaryFile(null)}>
            {t('body.clearFile')}
          </button>
        )}
      </div>
    </div>
  );
}

function JsonBody({ wordWrap }: { wordWrap: boolean }) {
  const body = useStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.request.body ?? '');
  const setBody = useStore((s) => s.setBody);

  const handleKeyDown = (e: EditorKeyEvent) => {
    if (isImeComposing(e)) return;
    if (isSendRequestShortcut(e)) {
      e.preventDefault();
    }
  };

  return (
    <CodeEditor
      value={body}
      onValueChange={setBody}
      language="json"
      features={{ envVars: true, lintJsonc: true, wordWrap }}
      fill
      onKeyDown={handleKeyDown}
      placeholder={t('body.json.placeholder')}
    />
  );
}

function RawContentEditor({
  rawContentType,
  wordWrap,
}: {
  rawContentType: RawContentType;
  wordWrap: boolean;
}) {
  const body = useStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.request.body ?? '');
  const setBody = useStore((s) => s.setBody);

  const placeholderKey = PLACEHOLDER_KEYS[rawContentType] ?? '';

  const handleKeyDown = (e: EditorKeyEvent) => {
    if (isImeComposing(e)) return;
    if (isSendRequestShortcut(e)) {
      e.preventDefault();
    }
  };

  return (
    <CodeEditor
      value={body}
      onValueChange={setBody}
      language="plain"
      features={{ envVars: true, wordWrap }}
      fill
      onKeyDown={handleKeyDown}
      placeholder={placeholderKey ? t(placeholderKey) : ''}
    />
  );
}

function FormBody() {
  const formFields = useStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.request.formFields ?? []);
  const updateFormField = useStore((s) => s.updateFormField);
  const setFormFieldType = useStore((s) => s.setFormFieldType);
  const setFormFieldFile = useStore((s) => s.setFormFieldFile);
  const clearFormFieldFile = useStore((s) => s.clearFormFieldFile);
  const removeFormField = useStore((s) => s.removeFormField);

  return (
    <BodyFormTable
      mode="form-data"
      fields={formFields}
      onUpdate={updateFormField}
      onSetFieldType={setFormFieldType}
      onSetFile={setFormFieldFile}
      onClearFile={clearFormFieldFile}
      onRemove={removeFormField}
    />
  );
}

function UrlencodedBody() {
  const urlEncodedFields = useStore(
    (s) => s.tabs.find((t) => t.id === s.activeTabId)?.request.urlEncodedFields ?? [],
  );
  const updateUrlEncodedField = useStore((s) => s.updateUrlEncodedField);
  const removeUrlEncodedField = useStore((s) => s.removeUrlEncodedField);

  return (
    <BodyFormTable
      mode="urlencoded"
      fields={urlEncodedFields}
      onUpdate={updateUrlEncodedField}
      onRemove={removeUrlEncodedField}
    />
  );
}

export default function BodyEditor() {
  const bodyType = useStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.request.bodyType ?? 'none');
  const rawContentType = useStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.request.rawContentType ?? 'json');
  const body = useStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.request.body ?? '');
  const setBodyType = useStore((s) => s.setBodyType);
  const setRawContentType = useStore((s) => s.setRawContentType);
  const setBody = useStore((s) => s.setBody);

  const handleFormat = () => {
    if (!body) return;
    const { formatted, valid } = formatJsonc(body);
    if (valid) setBody(formatted);
  };

  const handleMinify = () => {
    if (!body) return;
    if (parseJsonc(body, { ignoreEnvPlaceholders: true, allowTrailingComma: false }).valid) {
      setBody(jsoncToStrictJson(body));
    }
  };

  const handleNormalizeToJson = () => {
    if (!body) return;
    const res = normalizeToJsonText(body);
    if (!res.ok) return;
    if (res.text !== body) setBody(res.text);
  };

  const isJsonBody = bodyType === 'raw' && rawContentType === 'json';
  const isTextBody = bodyType === 'raw' && rawContentType === 'text';
  const fillEditor = bodyType === 'raw';
  const [wordWrap, setWordWrap] = useState(isTextBody);

  useEffect(() => {
    if (isTextBody) setWordWrap(true);
  }, [isTextBody]);

  return (
    <div className={`body-editor-root${fillEditor ? ' body-editor-root--fill' : ''}`}>
      {/* Body type tabs */}
      <div className="body-type-tabs" style={{ flexShrink: 0 }}>
        {BODY_TYPES.map(type => (
          <span
            key={type.value}
            className={`body-type-tab ${bodyType === type.value ? 'active' : ''}`}
            onClick={() => setBodyType(type.value)}
          >
            {t(type.label)}
          </span>
        ))}
        {bodyType === 'raw' && (
          <select
            className="raw-type-select"
            value={rawContentType}
            onChange={e => setRawContentType(e.target.value as RawContentType)}
          >
            {RAW_CONTENT_TYPES.map(type => (
              <option key={type.value} value={type.value}>{t(type.label)}</option>
            ))}
          </select>
        )}
        {fillEditor && (
          <div className="body-json-toolbar">
            <button
              type="button"
              className={`body-toolbar-btn body-wrap-btn${wordWrap ? ' body-wrap-btn--active' : ''}`}
              title={wordWrap ? t('response.wordWrapOff') : t('response.wordWrapOn')}
              aria-pressed={wordWrap}
              onClick={() => setWordWrap((v) => !v)}
            >
              {t('response.wordWrap')}
            </button>
            {isJsonBody && (
              <>
                <button type="button" className="body-toolbar-btn" onClick={handleFormat} disabled={!body}>
                  {t('body.json.format')}
                </button>
                <button type="button" className="body-toolbar-btn" onClick={handleMinify} disabled={!body}>
                  {t('body.json.minify')}
                </button>
                <button type="button" className="body-toolbar-btn" onClick={handleNormalizeToJson} disabled={!body}>
                  {t('body.json.normalize')}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Content area */}
      <div className="body-editor-content">
        {bodyType === 'none' && <NoneBody />}
        {bodyType === 'binary' && <BinaryBody />}
        {bodyType === 'raw' && rawContentType === 'json' && <JsonBody wordWrap={wordWrap} />}
        {bodyType === 'raw' && rawContentType !== 'json' && (
          <RawContentEditor rawContentType={rawContentType} wordWrap={wordWrap} />
        )}
        {bodyType === 'form-data' && <FormBody />}
        {bodyType === 'x-www-form-urlencoded' && <UrlencodedBody />}
      </div>
    </div>
  );
}
