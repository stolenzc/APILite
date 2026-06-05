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

  const { setLoading, setSending, setResponse, setStreamState, addHistory } = useStore.getState();
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
      // Avoid static import typing issues in some Tauri setups.
      const { listen } = (await import('@tauri-apps/api/event')) as unknown as {
        listen: (event: string, handler: (evt: { payload: unknown }) => void) => Promise<() => void>;
      };

      const streamId = `${activeTabId ?? 'no-tab'}:${seq}:${Date.now()}`;
      setStreamState(null);

      type StreamMetaPayload = {
        stream_id: string;
        status: number;
        status_text: string;
        headers: Record<string, string>;
        request_raw: string;
      };
      type StreamDonePayload = { stream_id: string; raw: string; duration_ms: number };

      let meta: Omit<StreamMetaPayload, 'stream_id'> | null = null;
      let body = '';
      let rawDone: Omit<StreamDonePayload, 'stream_id'> | null = null;
      let streamUrl: string | null = null;

      const unlistenMeta = await listen('http-stream-meta', (evt) => {
        const payload = evt.payload as StreamMetaPayload;
        if (payload.stream_id !== streamId) return;
        if (seq === cancelledSeq) return;
        meta = {
          status: payload.status,
          status_text: payload.status_text,
          headers: payload.headers,
          request_raw: payload.request_raw,
        };
        const ct = Object.entries(payload.headers).find(([k]) => k.toLowerCase() === 'content-type')?.[1] ?? '';
        if (ct.toLowerCase().includes('text/event-stream')) {
          streamUrl = resolved.finalUrl;
          setStreamState({ kind: 'sse', url: resolved.finalUrl, state: 'connected' });
        }
        setResponse({
          status: meta.status,
          statusText: meta.status_text,
          headers: meta.headers,
          body: '',
          durationMs: 0,
        });
      });

      const unlistenChunk = await listen('http-stream-chunk', (evt) => {
        const payload = evt.payload as { stream_id: string; chunk: string };
        if (payload.stream_id !== streamId) return;
          if (seq === cancelledSeq) return;
          body += payload.chunk;
          if (!meta) return;
          setResponse({
            status: meta.status,
            statusText: meta.status_text,
            headers: meta.headers,
            body,
            durationMs: 0,
          });
      });

      let unlistenDone: (() => void) | null = null;
      const donePromise = new Promise<void>((resolve) => {
        void listen('http-stream-done', (evt) => {
          const payload = evt.payload as StreamDonePayload;
          if (payload.stream_id !== streamId) return;
          if (seq === cancelledSeq) return;
          rawDone = { raw: payload.raw, duration_ms: payload.duration_ms };
          if (streamUrl) setStreamState({ kind: 'sse', url: streamUrl, state: 'closed' });
          resolve();
        }).then((fn) => {
          unlistenDone = fn;
        });
      });

      await invoke('send_request_stream', {
        streamId,
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

      await donePromise;

      unlistenMeta();
      unlistenChunk();
      // `listen()` returns an unlisten function; keep runtime-safe without fighting TS here.
      (unlistenDone as unknown as null | (() => void))?.();

      if (seq === cancelledSeq) return;

      if (meta == null || rawDone == null) return;
      const metaOk = meta as unknown as {
        status: number;
        status_text: string;
        headers: Record<string, string>;
        request_raw: string;
      };
      const rawOk = rawDone as unknown as { raw: string; duration_ms: number };

      const response: HttpResponse = {
        status: metaOk.status,
        statusText: metaOk.status_text,
        headers: metaOk.headers,
        body,
        raw: rawOk.raw,
        durationMs: rawOk.duration_ms,
      };
      setResponse(response);
      addHistory({
        method: reqToSend.method,
        url: resolved.finalUrl,
        status: response.status,
        requestRaw: metaOk.request_raw,
        responseRaw: response.raw ?? rawOk.raw,
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
