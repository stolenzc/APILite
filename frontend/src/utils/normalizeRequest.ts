import type { FormField, HttpRequest, KeyValue } from '../types';

export function emptyKeyValue(): KeyValue {
  return { key: '', value: '', enabled: true };
}

export function emptyFormField(): FormField {
  return { key: '', value: '', enabled: true, fieldType: 'text' };
}

/** Fill defaults for requests loaded from older collection JSON. */
export function normalizeHttpRequest(req: Partial<HttpRequest> & Pick<HttpRequest, 'method' | 'url'>): HttpRequest {
  return {
    method: req.method,
    url: req.url,
    params: req.params?.length ? req.params.map((p) => ({ ...p })) : [emptyKeyValue()],
    headers: req.headers?.length ? req.headers.map((h) => ({ ...h })) : [emptyKeyValue()],
    bodyType: req.bodyType ?? 'none',
    rawContentType: req.rawContentType ?? 'json',
    body: req.body ?? '',
    formFields: req.formFields?.length ? req.formFields.map((f) => ({ ...f })) : [emptyFormField()],
    urlEncodedFields: req.urlEncodedFields?.length
      ? req.urlEncodedFields.map((f) => ({ ...f }))
      : [emptyKeyValue()],
    binaryFile: req.binaryFile ? { ...req.binaryFile } : null,
  };
}

export function cloneHttpRequest(req: HttpRequest): HttpRequest {
  return normalizeHttpRequest(req);
}
