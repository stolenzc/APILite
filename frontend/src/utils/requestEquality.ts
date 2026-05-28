import type { BinaryBodyFile, FormField, HttpRequest, KeyValue } from '../types';
import { isFormFieldRowEmpty, isKeyValueRowEmpty } from './kvRows';

function canonicalizeKeyValues(rows: KeyValue[]): KeyValue[] {
  return rows
    .filter((r) => !isKeyValueRowEmpty(r))
    .map((r) => ({ key: r.key, value: r.value, enabled: r.enabled }));
}

function canonicalizeFormFields(rows: FormField[]): FormField[] {
  return rows
    .filter((r) => !isFormFieldRowEmpty(r))
    .map((r) => {
      const out: FormField = {
        key: r.key,
        value: r.value,
        enabled: r.enabled,
        fieldType: r.fieldType,
      };
      if (r.fileName) out.fileName = r.fileName;
      if (r.filePath) out.filePath = r.filePath;
      if (r.fileDataBase64) out.fileDataBase64 = r.fileDataBase64;
      return out;
    });
}

function canonicalizeBinaryFile(file: BinaryBodyFile | null): BinaryBodyFile | null {
  if (!file) return null;
  const out: BinaryBodyFile = { fileName: file.fileName };
  if (file.filePath) out.filePath = file.filePath;
  if (file.fileDataBase64) out.fileDataBase64 = file.fileDataBase64;
  return out;
}

/** Stable JSON for comparing requests (ignores trailing empty KV rows). */
export function canonicalizeRequest(req: HttpRequest): string {
  return JSON.stringify({
    method: req.method,
    url: req.url,
    params: canonicalizeKeyValues(req.params),
    headers: canonicalizeKeyValues(req.headers),
    bodyType: req.bodyType,
    rawContentType: req.rawContentType,
    body: req.body,
    formFields: canonicalizeFormFields(req.formFields),
    urlEncodedFields: canonicalizeKeyValues(req.urlEncodedFields),
    binaryFile: canonicalizeBinaryFile(req.binaryFile),
    preScriptId: req.preScriptId ?? null,
  });
}

export function requestsEqual(a: HttpRequest, b: HttpRequest): boolean {
  return canonicalizeRequest(a) === canonicalizeRequest(b);
}
