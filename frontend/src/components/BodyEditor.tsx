import { useStore, selectActiveTab } from '../store/useStore';
import { t } from '../i18n';

const BODY_TYPES = [
  { value: 'none', label: 'body.type.none' },
  { value: 'raw', label: 'body.type.raw' },
  { value: 'json', label: 'body.type.json' },
  { value: 'xml', label: 'body.type.xml' },
  { value: 'text', label: 'body.type.text' },
  { value: 'html', label: 'body.type.html' },
  { value: 'form-data', label: 'body.type.form-data' },
  { value: 'x-www-form-urlencoded', label: 'body.type.urlencoded' },
];

const CONTENT_TYPES: Record<string, string> = {
  json: 'application/json',
  xml: 'application/xml',
  text: 'text/plain',
  html: 'text/html',
  form: '',
  urlencoded: 'application/x-www-form-urlencoded',
};

const PLACEHOLDER_KEYS: Record<string, string> = {
  json: 'body.placeholder.json',
  xml: 'body.placeholder.xml',
  text: 'body.placeholder.text',
  html: 'body.placeholder.html',
};

export default function BodyEditor() {
  const { setBodyType, setBody, setActiveTab } = useStore();
  const activeTab = useStore(selectActiveTab);
  if (!activeTab) return null;
  const request = activeTab.request;

  if (request.bodyType === 'none') return null;

  const isRaw = ['json', 'xml', 'text', 'html', 'raw'].includes(request.bodyType);
  const isForm = request.bodyType === 'form-data';
  const isUrlencoded = request.bodyType === 'x-www-form-urlencoded';

  const placeholderKey = isRaw && PLACEHOLDER_KEYS[request.bodyType] ? PLACEHOLDER_KEYS[request.bodyType] : '';

  return (
    <div>
      <div className="form-type-select">
        <select value={request.bodyType} onChange={e => setBodyType(e.target.value as typeof request.bodyType)}>
          {BODY_TYPES.map(type => <option key={type.value} value={type.value}>{t(type.label)}</option>)}
        </select>
        {isRaw && (
          <span style={{ marginLeft: 12, fontSize: 11, color: 'var(--text-muted)' }}>
            Content-Type: {CONTENT_TYPES[request.bodyType === 'raw' ? 'text' : request.bodyType] || 'text/plain'}
          </span>
        )}
      </div>

      {isRaw && (
        <textarea
          className="body-editor"
          value={request.body}
          onChange={e => setBody(e.target.value)}
          placeholder={placeholderKey ? t(placeholderKey) : ''}
          spellCheck={false}
        />
      )}

      {(isForm || isUrlencoded) && (
        <div style={{ padding: '4px 16px', fontSize: 12, color: 'var(--text-muted)' }}>
          <p style={{ marginBottom: 8 }}>
            {isForm ? t('body.formHint') : t('body.urlencodedHint')}{' '}
            <span style={{ color: 'var(--accent)', cursor: 'pointer' }} onClick={() => setActiveTab('params')}>
              {t('body.useParamsLink')}
            </span>
          </p>
          {request.body && (
            <textarea
              className="body-editor"
              style={{ height: 120 }}
              value={request.body}
              onChange={e => setBody(e.target.value)}
              placeholder={isUrlencoded ? 'key1=value1&key2=value2' : ''}
              spellCheck={false}
            />
          )}
        </div>
      )}
    </div>
  );
}
