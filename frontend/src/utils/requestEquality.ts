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

function scalarFieldsEqual(a: HttpRequest, b: HttpRequest): boolean {
  return (
    a.method === b.method &&
    a.url === b.url &&
    a.bodyType === b.bodyType &&
    a.rawContentType === b.rawContentType &&
    a.body === b.body &&
    (a.preScriptId ?? null) === (b.preScriptId ?? null)
  );
}

function binaryFilesEqual(
  a: BinaryBodyFile | null,
  b: BinaryBodyFile | null,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.fileName === b.fileName &&
    (a.filePath ?? '') === (b.filePath ?? '') &&
    (a.fileDataBase64 ?? '') === (b.fileDataBase64 ?? '')
  );
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
  if (a === b) return true;
  if (!scalarFieldsEqual(a, b)) return false;
  if (!binaryFilesEqual(a.binaryFile, b.binaryFile)) return false;
  return canonicalizeRequest(a) === canonicalizeRequest(b);
}
