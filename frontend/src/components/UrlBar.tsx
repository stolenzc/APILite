import { useCallback, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { useSettingsStore } from '../store/useSettings';
import type { HttpMethod } from '../types';
import { t } from '../i18n';
import { hasHttpProtocol, interpolateEnvVars } from '../utils/envInterpolation';
import { useEnvironmentStore } from '../store/useEnvironmentStore';
import { isCurlCommand } from '../utils/curlUtils';
import { parseAndApplyCurlCommand } from '../utils/parseCurlCommand';
import { isImeComposing } from '../utils/keyboard';
import { focusUrlInput } from '../utils/focusUrl';
import { EnvVarField } from './EnvVarField';
import { sendHttpRequest } from '../utils/sendHttpRequest';
import { ensureProtocol } from '../utils/outboundRequest';

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

export default function UrlBar() {
  const { setMethod, setUrl, syncParamsFromUrl } = useStore();
  const requestMethod = useStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.request.method ?? 'GET');
  const requestUrl = useStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.request.url ?? '');
  const tab = useStore((s) => s.tabs.find((t) => t.id === s.activeTabId));
  const loading = tab?.loading ?? false;
  const sending = tab?.sending ?? false;

  useEffect(() => {
    const onFocusUrl = () => focusUrlInput();
    window.addEventListener('app:focus-url', onFocusUrl);
    return () => window.removeEventListener('app:focus-url', onFocusUrl);
  }, []);

  const applyCurlCommand = useCallback(
    (command: string) => parseAndApplyCurlCommand(command),
    [],
  );

  const handlePaste = async (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text');
    if (!isCurlCommand(text)) return;
    e.preventDefault();
    await applyCurlCommand(text);
  };

  const handleSend = async () => {
    if (!requestUrl) return;

    const reqAfterSync = (() => {
      const s = useStore.getState();
      const tab = s.tabs.find((t) => t.id === s.activeTabId);
      return tab?.request ?? null;
    })();
    if (!reqAfterSync?.url?.trim()) return;

    const autoProtocol = useSettingsStore.getState().autoCompleteProtocol;
    if (autoProtocol && !/\{\{/.test(reqAfterSync.url)) {
      const varsForProtocol = useEnvironmentStore.getState().getActiveVarMap();
      const resolvedForProtocol = interpolateEnvVars(reqAfterSync.url, varsForProtocol);
      if (!hasHttpProtocol(resolvedForProtocol)) {
        const fixedTemplate = ensureProtocol(reqAfterSync.url);
        if (fixedTemplate !== reqAfterSync.url) setUrl(fixedTemplate);
      }
    }

    await sendHttpRequest();
  };

  return (
    <div className="url-bar">
      <select className="method-select" value={requestMethod} onChange={e => setMethod(e.target.value as HttpMethod)}>
        {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
      </select>
      <div className="url-bar-url-field">
        <EnvVarField
          className="url-input"
          type="text"
          placeholder={t('url.placeholder')}
          value={requestUrl}
          onValueChange={(val) => {
            setUrl(val);
            syncParamsFromUrl();
          }}
          onPaste={handlePaste}
          onKeyDown={async (e) => {
            if (isImeComposing(e)) return;
            if (e.key === 'Enter') {
              if (isCurlCommand(requestUrl)) {
                e.preventDefault();
                await applyCurlCommand(requestUrl);
              } else {
                handleSend();
              }
            }
          }}
          suggestListId="url-env-suggest-list"
        />
      </div>
      <button className="btn btn-send" disabled={loading || sending} onClick={handleSend}>
        {loading || sending ? t('url.sending') : t('url.send')}
      </button>
    </div>
  );
}
