import { useStore } from '../store/useStore';
import type { BodyType, RawContentType } from '../types';
import { t } from '../i18n';

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

const CONTENT_TYPE_MAP: Record<RawContentType, string> = {
  json: 'application/json',
  xml: 'application/xml',
  text: 'text/plain',
  javascript: 'application/javascript',
  html: 'text/html',
};

const PLACEHOLDER_KEYS: Record<RawContentType, string> = {
  json: 'body.placeholder.json',
  xml: 'body.placeholder.xml',
  text: 'body.placeholder.text',
  javascript: 'body.placeholder.javascript',
  html: 'body.placeholder.html',
};

function NoneBody() {
  return <div style={{ padding: '24px 16px', color: 'var(--text-muted)', fontSize: 13 }}>No body</div>;
}

function BinaryBody() {
  return (
    <div style={{ padding: '24px 16px', color: 'var(--text-muted)', fontSize: 13 }}>
      Binary body: select a file via the request form. (Coming soon)
    </div>
  );
}

function RawContentEditor() {
  const rawContentType = useStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.request.rawContentType ?? 'json');
  const body = useStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.request.body ?? '');
  const setBody = useStore((s) => s.setBody);

  const placeholderKey = PLACEHOLDER_KEYS[rawContentType] ?? '';

  return (
    <textarea
      className="body-editor body-editor-flex"
      value={body}
      onChange={e => setBody(e.target.value)}
      placeholder={placeholderKey ? t(placeholderKey) : ''}
      spellCheck={false}
    />
  );
}

function FormBody() {
  const setActiveTab = useStore((s) => s.setActiveTab);
  return (
    <div style={{ padding: '8px 16px' }}>
      <p style={{ marginBottom: 8, fontSize: 12, color: 'var(--text-muted)' }}>
        {t('body.formHint')}{' '}
        <span style={{ color: 'var(--accent)', cursor: 'pointer' }} onClick={() => setActiveTab('params')}>
          {t('body.useParamsLink')}
        </span>
      </p>
    </div>
  );
}

function UrlencodedBody() {
  const body = useStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.request.body ?? '');
  const setBody = useStore((s) => s.setBody);
  const setActiveTab = useStore((s) => s.setActiveTab);

  return (
    <div style={{ padding: '8px 16px', display: 'flex', flexDirection: 'column', flex: 1 }}>
      <p style={{ marginBottom: 8, fontSize: 12, color: 'var(--text-muted)' }}>
        {t('body.urlencodedHint')}{' '}
        <span style={{ color: 'var(--accent)', cursor: 'pointer' }} onClick={() => setActiveTab('params')}>
          {t('body.useParamsLink')}
        </span>
      </p>
      <textarea
        className="body-editor body-editor-flex"
        value={body}
        onChange={e => setBody(e.target.value)}
        placeholder="key1=value1&key2=value2"
        spellCheck={false}
      />
    </div>
  );
}

export default function BodyEditor() {
  const bodyType = useStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.request.bodyType ?? 'none');
  const rawContentType = useStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.request.rawContentType ?? 'json');
  const setBodyType = useStore((s) => s.setBodyType);
  const setRawContentType = useStore((s) => s.setRawContentType);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Primary tabs */}
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
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8, lineHeight: '28px' }}>
            Content-Type: {CONTENT_TYPE_MAP[rawContentType]}
          </span>
        )}
      </div>

      {/* Secondary tabs for raw */}
      {bodyType === 'raw' && (
        <div className="raw-content-tabs" style={{ flexShrink: 0 }}>
          {RAW_CONTENT_TYPES.map(type => (
            <span
              key={type.value}
              className={`raw-content-tab ${rawContentType === type.value ? 'active' : ''}`}
              onClick={() => setRawContentType(type.value)}
            >
              {t(type.label)}
            </span>
          ))}
        </div>
      )}

      {/* Content area */}
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {bodyType === 'none' && <NoneBody />}
        {bodyType === 'binary' && <BinaryBody />}
        {bodyType === 'raw' && <RawContentEditor />}
        {bodyType === 'form-data' && <FormBody />}
        {bodyType === 'x-www-form-urlencoded' && <UrlencodedBody />}
      </div>
    </div>
  );
}
