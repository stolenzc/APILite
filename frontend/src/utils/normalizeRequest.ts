import type { FormField, HttpRequest, KeyValue } from '../types';
import { withTrailingEmptyRow, withTrailingFormFieldRow } from './kvRows';

export function emptyKeyValue(): KeyValue {
  return { key: '', value: '', enabled: true };
}

export function emptyFormField(): FormField {
  return { key: '', value: '', enabled: true, fieldType: 'text' };
}

type RequestWithLegacyScript = Partial<HttpRequest> & {
  postScriptId?: string | null;
};

/** Resolve pre-script id; explicit `preScriptId: null` must not fall back to legacy postScriptId. */
export function resolvePreScriptId(req: RequestWithLegacyScript): string | null {
  if (Object.prototype.hasOwnProperty.call(req, 'preScriptId')) {
    const id = req.preScriptId;
    return id && String(id).trim() ? String(id).trim() : null;
  }
  const legacy = req.postScriptId;
  return legacy && String(legacy).trim() ? String(legacy).trim() : null;
}

/** Fill defaults for requests loaded from older saved-request JSON. */
export function normalizeHttpRequest(req: Partial<HttpRequest> & Pick<HttpRequest, 'method' | 'url'>): HttpRequest {
  return {
    method: req.method,
    url: req.url,
    params: withTrailingEmptyRow(
      req.params?.length ? req.params.map((p) => ({ ...p })) : [],
      emptyKeyValue,
    ),
    headers: withTrailingEmptyRow(
      req.headers?.length ? req.headers.map((h) => ({ ...h })) : [],
      emptyKeyValue,
    ),
    bodyType: req.bodyType ?? 'none',
    rawContentType: req.rawContentType ?? 'json',
    body: req.body ?? '',
    formFields: withTrailingFormFieldRow(
      req.formFields?.length ? req.formFields.map((f) => ({ ...f })) : [],
      emptyFormField,
    ),
    urlEncodedFields: withTrailingEmptyRow(
      req.urlEncodedFields?.length ? req.urlEncodedFields.map((f) => ({ ...f })) : [],
      emptyKeyValue,
    ),
    binaryFile: req.binaryFile ? { ...req.binaryFile } : null,
    preScriptId: resolvePreScriptId(req as RequestWithLegacyScript),
  };
}

export function cloneHttpRequest(req: HttpRequest): HttpRequest {
  return normalizeHttpRequest(req);
}
