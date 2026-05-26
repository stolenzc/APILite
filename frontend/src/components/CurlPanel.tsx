import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import { useSettingsStore } from '../store/useSettings';
import { useEnvironmentStore } from '../store/useEnvironmentStore';
import { buildRawVarMapForEnv } from '../utils/environmentScope';
import { resolveVariableMap } from '../utils/envInterpolation';
import { buildCurlForRequest } from '../utils/curlExport';
import { isCurlCommand } from '../utils/curlUtils';
import { parseAndApplyCurlCommand } from '../utils/parseCurlCommand';
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
  const activeTabId = useStore((s) => s.activeTabId);
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
  const exportDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const parseDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusedRef = useRef(false);
  const skipExportRef = useRef(false);
  const sig = useMemo(() => requestSignature(activeRequest), [activeRequest]);

  useEffect(() => {
    focusedRef.current = false;
    skipExportRef.current = false;
  }, [activeTabId]);

  useEffect(() => {
    if (exportDebounceRef.current) clearTimeout(exportDebounceRef.current);
    if (focusedRef.current) return;
    if (skipExportRef.current) {
      skipExportRef.current = false;
      return;
    }

    if (!activeRequest?.url?.trim()) {
      setCurl('');
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    let cancelled = false;
    exportDebounceRef.current = setTimeout(() => {
      void buildCurlForRequest(activeRequest)
        .then((text) => {
          if (cancelled || focusedRef.current) return;
          setCurl(text);
          setError(null);
          setLoading(false);
        })
        .catch((err) => {
          if (cancelled || focusedRef.current) return;
          setCurl('');
          setError(String(err));
          setLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      if (exportDebounceRef.current) clearTimeout(exportDebounceRef.current);
    };
  }, [sig, activeRequest, envSig, autoCompleteProtocol]);

  const scheduleParse = useCallback((command: string) => {
    if (parseDebounceRef.current) clearTimeout(parseDebounceRef.current);
    const trimmed = command.trim();
    if (!trimmed) return;

    parseDebounceRef.current = setTimeout(() => {
      if (!isCurlCommand(trimmed)) return;
      skipExportRef.current = true;
      void parseAndApplyCurlCommand(trimmed);
    }, 400);
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setCurl(value);
      scheduleParse(value);
    },
    [scheduleParse],
  );

  const handleBlur = useCallback(() => {
    focusedRef.current = false;
    const trimmed = curl.trim();
    if (!trimmed || isCurlCommand(trimmed)) return;

    if (!activeRequest?.url?.trim()) {
      setCurl('');
      return;
    }

    setLoading(true);
    void buildCurlForRequest(activeRequest)
      .then((text) => {
        setCurl(text);
        setError(null);
        setLoading(false);
      })
      .catch((err) => {
        setCurl('');
        setError(String(err));
        setLoading(false);
      });
  }, [curl, activeRequest]);

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

  const placeholder = loading && !curl
    ? t('curl.generating')
    : !activeRequest?.url?.trim()
      ? t('curl.empty')
      : t('curl.placeholder');

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
          {error && <div className="curl-panel-error">{error}</div>}
          <textarea
            className="curl-panel-input"
            value={curl}
            onChange={handleChange}
            onFocus={() => {
              focusedRef.current = true;
            }}
            onBlur={handleBlur}
            placeholder={placeholder}
            spellCheck={false}
          />
        </div>
      )}
    </aside>
  );
}
