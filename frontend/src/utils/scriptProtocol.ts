import type { BodyType, HttpMethod, HttpRequest, KeyValue } from '../types';
import { emptyKeyValue, normalizeHttpRequest } from './normalizeRequest';
import { withTrailingEmptyRow } from './kvRows';
import { jsoncToStrictJson, parseJsonc } from './jsonUtils';

export interface ScriptRequestPatch {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  bodyType?: string;
  body?: string;
}

export interface ScriptRunResult {
  ok: boolean;
  vars: Record<string, string>;
  requestPatch?: ScriptRequestPatch;
  error?: string;
  stderr?: string;
  durationMs: number;
}

const HTTP_METHODS = new Set<string>(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);

function buildRequestContext(request: HttpRequest): Record<string, unknown> {
  const trimmed = request.body.trim();
  const isJsonBody =
    request.bodyType === 'raw' && request.rawContentType === 'json' && trimmed.length > 0;

  let bodyForScript = request.body;
  const ctx: Record<string, unknown> = {
    method: request.method,
    url: request.url,
    headers: keyValuesToMap(request.headers),
    bodyType: request.bodyType,
    rawContentType: request.rawContentType,
    body: request.body,
  };

  if (isJsonBody) {
    const { value, valid } = parseJsonc(request.body);
    if (valid) {
      ctx.bodyJson = value;
      bodyForScript = jsoncToStrictJson(request.body);
      ctx.body = bodyForScript;
    } else {
      ctx.bodyParseError = 'Invalid JSONC in request body';
    }
  }

  return ctx;
}

export function buildPreScriptPayload(
  request: HttpRequest,
  env: Record<string, string>,
  vars: Record<string, string>,
): string {
  return JSON.stringify({
    phase: 'pre',
    request: buildRequestContext(request),
    env,
    vars,
  });
}

function keyValuesToMap(rows: KeyValue[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const row of rows) {
    if (row.enabled && row.key) out[row.key] = row.value;
  }
  return out;
}

function mergeHeaderPatch(rows: KeyValue[], patch: Record<string, string>): KeyValue[] {
  const next = rows.map((r) => ({ ...r }));
  for (const [key, value] of Object.entries(patch)) {
    const idx = next.findIndex((r) => r.key === key);
    if (idx >= 0) {
      next[idx] = { ...next[idx], value, enabled: true };
    } else {
      const emptyIdx = next.findIndex((r) => !r.key.trim() && !r.value.trim());
      if (emptyIdx >= 0) next[emptyIdx] = { key, value, enabled: true };
      else next.push({ key, value, enabled: true });
    }
  }
  return withTrailingEmptyRow(next, emptyKeyValue);
}

export function applyRequestPatch(req: HttpRequest, patch: ScriptRequestPatch): HttpRequest {
  let method = req.method;
  if (patch.method && HTTP_METHODS.has(patch.method.toUpperCase())) {
    method = patch.method.toUpperCase() as HttpMethod;
  }

  const partial: Partial<HttpRequest> & Pick<HttpRequest, 'method' | 'url'> = {
    method,
    url: patch.url !== undefined ? patch.url : req.url,
    params: req.params,
    headers: patch.headers ? mergeHeaderPatch(req.headers, patch.headers) : req.headers,
    bodyType: req.bodyType,
    rawContentType: req.rawContentType,
    body: patch.body !== undefined ? patch.body : req.body,
    formFields: req.formFields,
    urlEncodedFields: req.urlEncodedFields,
    binaryFile: req.binaryFile,
    preScriptId: req.preScriptId,
  };

  if (patch.bodyType && ['none', 'form-data', 'x-www-form-urlencoded', 'raw', 'binary'].includes(patch.bodyType)) {
    partial.bodyType = patch.bodyType as BodyType;
  }

  return normalizeHttpRequest(partial);
}

export function parseScriptRunResult(raw: {
  ok?: boolean | string | number;
  vars?: Record<string, unknown>;
  request?: Record<string, unknown> | null;
  error?: string | null;
  stderr?: string | null;
  duration_ms: number;
}): ScriptRunResult {
  const vars: Record<string, string> = {};
  if (raw.vars && typeof raw.vars === 'object') {
    for (const [k, v] of Object.entries(raw.vars)) {
      if (v === null || v === undefined) continue;
      vars[k] = typeof v === 'string' ? v : JSON.stringify(v);
    }
  }

  let requestPatch: ScriptRequestPatch | undefined;
  if (raw.request && typeof raw.request === 'object') {
    const r = raw.request;
    requestPatch = {};
    if (typeof r.method === 'string') requestPatch.method = r.method;
    if (typeof r.url === 'string') requestPatch.url = r.url;
    if (typeof r.body === 'string') requestPatch.body = r.body;
    if (typeof r.bodyType === 'string') requestPatch.bodyType = r.bodyType;
    if (r.headers && typeof r.headers === 'object' && !Array.isArray(r.headers)) {
      const headers: Record<string, string> = {};
      for (const [k, v] of Object.entries(r.headers as Record<string, unknown>)) {
        if (v === null || v === undefined) continue;
        headers[k] = typeof v === 'string' ? v : JSON.stringify(v);
      }
      if (Object.keys(headers).length > 0) requestPatch.headers = headers;
    }
    if (Object.keys(requestPatch).length === 0) requestPatch = undefined;
  }

  const okFlag = raw.ok as boolean | string | number | undefined;
  const ok = okFlag !== false && okFlag !== 'false' && okFlag !== 0;

  return {
    ok,
    vars,
    requestPatch,
    error: raw.error ?? undefined,
    stderr: raw.stderr ?? undefined,
    durationMs: raw.duration_ms,
  };
}
