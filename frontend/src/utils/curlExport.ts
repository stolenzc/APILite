import { invoke } from '@tauri-apps/api/core';
import type { HttpRequest } from '../types';
import { useSettingsStore } from '../store/useSettings';
import { kvToMap, resolveOutboundRequest } from './outboundRequest';

export async function buildCurlForRequest(
  req: HttpRequest,
  vars: Record<string, string>,
): Promise<string> {
  if (!req.url?.trim()) return '';

  const autoProtocol = useSettingsStore.getState().autoCompleteProtocol;
  const resolved = resolveOutboundRequest(req, vars, autoProtocol);

  return invoke<string>('to_curl', {
    method: req.method,
    url: resolved.finalUrl,
    headers: kvToMap(resolved.headers),
    bodyType: resolved.effectiveBodyType,
    body: resolved.body,
    formFields: resolved.formFields,
    binaryFilePath: resolved.binaryFile?.filePath ?? null,
    binaryFileName: resolved.binaryFile?.fileName ?? null,
    binaryDataBase64: resolved.binaryFile?.fileDataBase64 ?? null,
  });
}
