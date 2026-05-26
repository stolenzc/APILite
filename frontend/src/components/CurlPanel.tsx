import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import { useSettingsStore } from '../store/useSettings';
import { useEnvironmentStore } from '../store/useEnvironmentStore';
import { buildRawVarMapForEnv } from '../utils/environmentScope';
import { resolveVariableMap } from '../utils/envInterpolation';
import { buildCurlForRequest } from '../utils/curlExport';
import { highlightCurl } from '../utils/curlHighlight';
import { showToast } from '../utils/toast';
import { t } from '../i18n';
import type { HttpRequest } from '../types';

function requestSignature(req: HttpRequest | null): string {
  if (!req) return '';
  return JSON.stringify({
    method: req.method,
    url: req.url,
    headers: req.headers,
    bodyType: req.bodyType,
    body: req.body,
    formFields: req.formFields,
    urlEncodedFields: req.urlEncodedFields,
    binaryFile: req.binaryFile,
  });
}

export default function CurlPanel() {
  const activeRequest = useStore((s) => {
    const tab = s.tabs.find((t) => t.id === s.activeTabId);
    return tab?.request ?? null;
  });
  const { curlPanelWidth, curlPanelCollapsed, setCurlPanelCollapsed } = useSettingsStore();
  const autoCompleteProtocol = useSettingsStore((s) => s.autoCompleteProtocol);
  /** Resolved active-env values; changes when switching env or editing variables. */
  const envSig = useEnvironmentStore((s) => {
    const raw = buildRawVarMapForEnv(s.variables, s.activeEnvironmentId);
    return JSON.stringify(resolveVariableMap(raw));
  });

  const [curl, setCurl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sig = useMemo(() => requestSignature(activeRequest), [activeRequest]);
  const highlightedCurl = useMemo(() => (curl ? highlightCurl(curl) : ''), [curl]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!activeRequest?.url?.trim()) {
      setCurl('');
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    let cancelled = false;
    debounceRef.current = setTimeout(() => {
      void buildCurlForRequest(activeRequest)
        .then((text) => {
          if (cancelled) return;
          setCurl(text);
          setError(null);
          setLoading(false);
        })
        .catch((err) => {
          if (cancelled) return;
          setCurl('');
          setError(String(err));
          setLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [sig, activeRequest, envSig, autoCompleteProtocol]);

  const handleCopy = useCallback(async () => {
    if (!curl) return;
    try {
      await navigator.clipboard.writeText(curl);
      showToast(t('curl.copied'));
    } catch {
      showToast(t('curl.copyFailed'));
    }
  }, [curl]);

  const panelStyle = curlPanelCollapsed
    ? { width: 32, minWidth: 32 }
    : { width: curlPanelWidth, minWidth: curlPanelWidth };

  return (
    <aside
      className={`curl-panel ${curlPanelCollapsed ? 'curl-panel-collapsed' : ''}`}
      style={panelStyle}
    >
      <div
        className="curl-panel-header"
        onClick={() => setCurlPanelCollapsed(!curlPanelCollapsed)}
        title={curlPanelCollapsed ? t('curl.expand') : t('curl.collapse')}
      >
        <span className="curl-panel-chevron">{curlPanelCollapsed ? '◀' : '▶'}</span>
        {!curlPanelCollapsed && <span className="curl-panel-title">{t('curl.title')}</span>}
        {!curlPanelCollapsed && (
          <button
            type="button"
            className="btn btn-secondary curl-panel-copy"
            disabled={!curl || loading}
            onClick={(e) => {
              e.stopPropagation();
              void handleCopy();
            }}
          >
            {t('curl.copy')}
          </button>
        )}
      </div>
      {!curlPanelCollapsed && (
        <div className="curl-panel-body">
          {loading && !curl && (
            <div className="curl-panel-placeholder">{t('curl.generating')}</div>
          )}
          {error && <div className="curl-panel-error">{error}</div>}
          {!loading && !error && !curl && (
            <div className="curl-panel-placeholder">{t('curl.empty')}</div>
          )}
          {curl && (
            <pre
              className="curl-panel-content curl-highlight"
              dangerouslySetInnerHTML={{ __html: highlightedCurl }}
            />
          )}
        </div>
      )}
    </aside>
  );
}
