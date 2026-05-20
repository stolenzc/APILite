import { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { matchesShortcut, useSettingsStore } from '../store/useSettings';
import type { BodyType, RawContentType } from '../types';
import { t } from '../i18n';
import { formatJson, isJson } from '../utils/jsonUtils';
import { EnvVarField } from './EnvVarField';

function isSendRequestShortcut(e: React.KeyboardEvent): boolean {
  return matchesShortcut(e, useSettingsStore.getState().shortcuts.sendRequest);
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
  return <div style={{ padding: '24px 16px', color: 'var(--text-muted)', fontSize: 13 }}>{t('body.noBody')}</div>;
}

function BinaryBody() {
  return (
    <div style={{ padding: '24px 16px', color: 'var(--text-muted)', fontSize: 13 }}>
      {t('body.binary')}
    </div>
  );
}

function JsonBody() {
  const body = useStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.request.body ?? '');
  const setBody = useStore((s) => s.setBody);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isSendRequestShortcut(e)) {
      e.preventDefault();
      return;
    }

    if (e.key === 'Tab' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const before = body.substring(0, start);
      const after = body.substring(end);
      if (e.shiftKey) {
        const lineStart = before.lastIndexOf('\n') + 1;
        const linePrefix = before.substring(lineStart);
        const removed = linePrefix.replace(/^ {1,2}/, '');
        setBody(before.substring(0, lineStart) + removed + after);
        const newPos = start - (linePrefix.length - removed.length);
        setTimeout(() => { ta.selectionStart = ta.selectionEnd = newPos; }, 0);
      } else {
        setBody(before + '  ' + after);
        setTimeout(() => { ta.selectionStart = ta.selectionEnd = start + 2; }, 0);
      }
    }

    if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) {
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const lineStart = body.lastIndexOf('\n', start - 1) + 1;
      const linePrefix = body.substring(lineStart, start).match(/^(\s*)/)?.[1] ?? '';

      const charBefore = body[start - 1];
      const charAfter = body[start];
      if ((charBefore === '{' || charBefore === '[') && (charAfter === '}' || charAfter === ']')) {
        e.preventDefault();
        const indent = linePrefix + '  ';
        const insert = '\n' + indent + '\n' + linePrefix;
        setBody(body.substring(0, start) + insert + body.substring(start));
        setTimeout(() => {
          ta.selectionStart = ta.selectionEnd = start + 1 + indent.length;
        }, 0);
      } else if (charBefore === '{' || charBefore === '[') {
        e.preventDefault();
        const indent = linePrefix + '  ';
        const insert = '\n' + indent;
        setBody(body.substring(0, start) + insert + body.substring(start));
        setTimeout(() => { ta.selectionStart = ta.selectionEnd = start + insert.length; }, 0);
      } else if (charBefore === ',') {
        e.preventDefault();
        const insert = '\n' + linePrefix;
        setBody(body.substring(0, start) + insert + body.substring(start));
        setTimeout(() => { ta.selectionStart = ta.selectionEnd = start + insert.length; }, 0);
      } else if (linePrefix) {
        e.preventDefault();
        const insert = '\n' + linePrefix;
        setBody(body.substring(0, start) + insert + body.substring(start));
        setTimeout(() => { ta.selectionStart = ta.selectionEnd = start + insert.length; }, 0);
      }
    }

    const autoClosePairs: [string, string][] = [['[', ']'], ['"', '"']];
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const charAfter = body[start];
      if (e.key === '{') {
        const charBefore = body[start - 1];
        if (charBefore === '{') return;
        if (charAfter === '}') {
          e.preventDefault();
          setTimeout(() => { ta.selectionStart = ta.selectionEnd = start + 1; }, 0);
          return;
        }
        return;
      }
      for (const [open, close] of autoClosePairs) {
        if (e.key === open) {
          if (charAfter === close) {
            e.preventDefault();
            setTimeout(() => { ta.selectionStart = ta.selectionEnd = start + 1; }, 0);
            return;
          } else if (open === '"') {
            const charBefore = body[start - 1];
            const shouldClose = !charBefore || /[\s{[\(,:]/.test(charBefore);
            if (shouldClose) {
              e.preventDefault();
              const insert = '""';
              setBody(body.substring(0, start) + insert + body.substring(start));
              setTimeout(() => { ta.selectionStart = ta.selectionEnd = start + 1; }, 0);
            }
          } else {
            e.preventDefault();
            const insert = open + close;
            setBody(body.substring(0, start) + insert + body.substring(start));
            setTimeout(() => { ta.selectionStart = ta.selectionEnd = start + 1; }, 0);
          }
          return;
        }
      }
    }
  };

  return (
    <EnvVarField
      as="textarea"
      className="body-editor body-editor-flex json-textarea"
      value={body}
      onValueChange={setBody}
      onKeyDown={handleKeyDown}
      placeholder={t('body.json.placeholder')}
      spellCheck={false}
      autoCapitalize="off"
      autoCorrect="off"
    />
  );
}

function RawContentEditor({ rawContentType }: { rawContentType: RawContentType }) {
  const body = useStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.request.body ?? '');
  const setBody = useStore((s) => s.setBody);

  const placeholderKey = PLACEHOLDER_KEYS[rawContentType] ?? '';

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isSendRequestShortcut(e)) {
      e.preventDefault();
    }
  };

  return (
    <EnvVarField
      as="textarea"
      className="body-editor body-editor-flex"
      value={body}
      onValueChange={setBody}
      onKeyDown={handleKeyDown}
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
      <EnvVarField
        as="textarea"
        className="body-editor body-editor-flex"
        value={body}
        onValueChange={setBody}
        onKeyDown={(e) => { if (isSendRequestShortcut(e)) e.preventDefault(); }}
        placeholder="key1=value1&key2=value2"
        spellCheck={false}
      />
    </div>
  );
}

export default function BodyEditor() {
  const bodyType = useStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.request.bodyType ?? 'none');
  const rawContentType = useStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.request.rawContentType ?? 'json');
  const body = useStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.request.body ?? '');
  const setBodyType = useStore((s) => s.setBodyType);
  const setRawContentType = useStore((s) => s.setRawContentType);
  const setBody = useStore((s) => s.setBody);

  const jsonValid = body.length > 0 && isJson(body);

  const handleFormat = () => {
    if (!body) return;
    const { formatted, valid } = formatJson(body);
    if (valid) setBody(formatted);
  };

  const handleMinify = () => {
    if (!body) return;
    const { formatted, valid } = formatJson(body);
    if (valid) setBody(formatted.replace(/\n\s*/g, ''));
  };

  const isJsonBody = bodyType === 'raw' && rawContentType === 'json';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
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
        {isJsonBody && body.length > 0 && (
          <span className={`json-status ${jsonValid ? 'valid' : 'invalid'}`}>
            {jsonValid ? t('body.json.valid') : t('body.json.invalid')}
          </span>
        )}
        {isJsonBody && (
          <button className="body-toolbar-btn" onClick={handleFormat} disabled={!body}>
            {t('body.json.format')}
          </button>
        )}
        {isJsonBody && (
          <button className="body-toolbar-btn" onClick={handleMinify} disabled={!body}>
            {t('body.json.minify')}
          </button>
        )}
      </div>

      {/* Content area */}
      <div className="body-editor-content">
        {bodyType === 'none' && <NoneBody />}
        {bodyType === 'binary' && <BinaryBody />}
        {bodyType === 'raw' && rawContentType === 'json' && <JsonBody />}
        {bodyType === 'raw' && rawContentType !== 'json' && <RawContentEditor rawContentType={rawContentType} />}
        {bodyType === 'form-data' && <FormBody />}
        {bodyType === 'x-www-form-urlencoded' && <UrlencodedBody />}
      </div>
    </div>
  );
}
