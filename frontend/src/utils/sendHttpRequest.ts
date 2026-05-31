import { invoke } from '@tauri-apps/api/core';
import type { HttpResponse } from '../types';
import { useStore } from '../store/useStore';
import { resolveOutboundRequest, kvToMap } from './outboundRequest';
import { formatRawHttpResponse } from './httpUtils';
import { buildCurlForRequest } from './curlExport';
import {
  getActiveHttpRequest,
  OutboundPrepareError,
  prepareOutboundRequest,
} from './outboundPrepare';
import { useSettingsStore } from '../store/useSettings';

function showToast(message: string) {
  window.dispatchEvent(new CustomEvent('app:toast', { detail: message }));
}

export const OUTBOUND_CURL_EVENT = 'app:outbound-curl';

let activeSendSeq = 0;
let cancelledSeq = 0;

export function cancelHttpRequest(): void {
  cancelledSeq = activeSendSeq;
  const { setLoading, setSending } = useStore.getState();
  setLoading(false);
  setSending(false);
}

export async function sendHttpRequest(): Promise<void> {
  const req = getActiveHttpRequest();
  if (!req?.url?.trim()) return;

  const { setLoading, setSending, setResponse, addHistory } = useStore.getState();
  const autoProtocol = useSettingsStore.getState().autoCompleteProtocol;
  const activeTabId = useStore.getState().activeTabId;

  const seq = ++activeSendSeq;
  cancelledSeq = 0;

  setSending(true);
  try {
    const { request: reqToSend, vars } = await prepareOutboundRequest(req);
    if (seq === cancelledSeq) return;

    try {
      const curl = await buildCurlForRequest(reqToSend, vars);
      if (activeTabId) {
        window.dispatchEvent(
          new CustomEvent(OUTBOUND_CURL_EVENT, {
            detail: { tabId: activeTabId, curl },
          }),
        );
      }
    } catch {
      /* cURL preview is best-effort */
    }
    if (seq === cancelledSeq) return;

    const resolved = resolveOutboundRequest(reqToSend, vars, autoProtocol);

    setLoading(true);
    try {
      const res = await invoke<{
        status: number;
        status_text: string;
        headers: Record<string, string>;
        body: string;
        request_raw: string;
        raw: string;
        duration_ms: number;
      }>('send_request', {
        method: reqToSend.method,
        url: resolved.finalUrl,
        headers: kvToMap(resolved.headers),
        bodyType: resolved.effectiveBodyType,
        body: resolved.body,
        formFields: resolved.formFields,
        binaryFilePath: resolved.binaryFile?.filePath ?? null,
        binaryFileName: resolved.binaryFile?.fileName ?? null,
        binaryDataBase64: resolved.binaryFile?.fileDataBase64 ?? null,
      });
      if (seq === cancelledSeq) return;

      const response: HttpResponse = {
        status: res.status,
        statusText: res.status_text,
        headers: res.headers,
        body: res.body,
        raw: res.raw,
        durationMs: res.duration_ms,
      };

      setResponse(response);

      addHistory({
        method: reqToSend.method,
        url: resolved.finalUrl,
        status: response.status,
        requestRaw: res.request_raw,
        responseRaw: response.raw ?? res.raw,
      });
    } catch (err) {
      if (seq === cancelledSeq) return;
      const errorResponse = {
        status: 0,
        statusText: 'Error',
        headers: {} as Record<string, string>,
        body: String(err),
        durationMs: 0,
      };
      setResponse({
        ...errorResponse,
        raw: formatRawHttpResponse(errorResponse),
      });
    } finally {
      if (seq !== cancelledSeq) setLoading(false);
    }
  } catch (err) {
    if (seq === cancelledSeq) return;
    if (err instanceof OutboundPrepareError) {
      showToast(err.message);
    } else {
      showToast(String(err));
    }
  } finally {
    if (seq !== cancelledSeq) setSending(false);
  }
}
