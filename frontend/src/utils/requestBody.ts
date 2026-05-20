import type { BinaryBodyFile, FormField, HttpRequest, KeyValue } from '../types';
import { interpolateEnvVars } from './envInterpolation';

export interface OutboundFormField {
  key: string;
  value?: string;
  filePath?: string;
  fileName?: string;
  fileDataBase64?: string;
}

export function buildUrlEncodedBody(fields: KeyValue[]): string {
  return fields
    .filter((f) => f.enabled && f.key.trim())
    .map((f) => `${encodeURIComponent(f.key)}=${encodeURIComponent(f.value)}`)
    .join('&');
}

function interpolateFormField(field: FormField, vars: Record<string, string>): FormField {
  return {
    ...field,
    key: interpolateEnvVars(field.key, vars),
    value: interpolateEnvVars(field.value, vars),
    fileName: field.fileName ? interpolateEnvVars(field.fileName, vars) : undefined,
    filePath: field.filePath ? interpolateEnvVars(field.filePath, vars) : undefined,
  };
}

export function resolveFormFields(
  fields: FormField[],
  vars: Record<string, string>,
): OutboundFormField[] {
  const out: OutboundFormField[] = [];
  for (const raw of fields) {
    if (!raw.enabled || !raw.key.trim()) continue;
    const field = interpolateFormField(raw, vars);
    if (field.fieldType === 'file') {
      if (field.filePath) {
        out.push({
          key: field.key,
          filePath: field.filePath,
          fileName: field.fileName || field.filePath.split(/[/\\]/).pop() || 'file',
        });
      } else if (field.fileDataBase64) {
        out.push({
          key: field.key,
          fileName: field.fileName || 'file',
          fileDataBase64: field.fileDataBase64,
        });
      }
      continue;
    }
    out.push({ key: field.key, value: field.value });
  }
  return out;
}

export function interpolateKeyValues(fields: KeyValue[], vars: Record<string, string>): KeyValue[] {
  return fields.map((f) => ({
    ...f,
    key: interpolateEnvVars(f.key, vars),
    value: interpolateEnvVars(f.value, vars),
  }));
}

export function resolveBinaryFile(
  file: BinaryBodyFile | null,
  vars: Record<string, string>,
): BinaryBodyFile | null {
  if (!file) return null;
  return {
    fileName: interpolateEnvVars(file.fileName, vars),
    filePath: file.filePath ? interpolateEnvVars(file.filePath, vars) : undefined,
    fileDataBase64: file.fileDataBase64,
  };
}

export interface ResolvedOutboundBody {
  effectiveBodyType: string;
  body: string | null;
  formFields: OutboundFormField[];
  binaryFile: BinaryBodyFile | null;
}

export function resolveOutboundBody(
  req: HttpRequest,
  vars: Record<string, string>,
): ResolvedOutboundBody {
  const effectiveBodyType = req.bodyType === 'raw' ? req.rawContentType : req.bodyType;

  if (req.bodyType === 'none') {
    return { effectiveBodyType, body: null, formFields: [], binaryFile: null };
  }

  if (req.bodyType === 'x-www-form-urlencoded') {
    const fields = interpolateKeyValues(req.urlEncodedFields, vars);
    const encoded = buildUrlEncodedBody(fields);
    return {
      effectiveBodyType,
      body: encoded || null,
      formFields: [],
      binaryFile: null,
    };
  }

  if (req.bodyType === 'form-data') {
    return {
      effectiveBodyType,
      body: null,
      formFields: resolveFormFields(req.formFields, vars),
      binaryFile: null,
    };
  }

  if (req.bodyType === 'binary') {
    return {
      effectiveBodyType,
      body: null,
      formFields: [],
      binaryFile: resolveBinaryFile(req.binaryFile, vars),
    };
  }

  const body = req.body ? interpolateEnvVars(req.body, vars) : null;
  return { effectiveBodyType, body, formFields: [], binaryFile: null };
}
