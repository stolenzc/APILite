import type { HttpRequest, KeyValue } from '../types';
import {
  hasHttpProtocol,
  interpolateEnvVars,
  interpolateKeyValues,
  interpolateEnvVarsSelected,
  interpolateKeyValuesSelected,
} from './envInterpolation';
import { resolveOutboundBody } from './requestBody';
import { resolveOutboundBodySelected } from './requestBody';

/** Resolve env placeholders for outbound HTTP and cURL export (not for editor UI). */
export function resolveOutboundRequest(
  req: HttpRequest,
  vars: Record<string, string>,
  autoProtocol: boolean,
) {
  const interpolatedUrl = interpolateEnvVars(req.url, vars);
  const headers = interpolateKeyValues(req.headers, vars);
  let finalUrl = interpolatedUrl;
  if (autoProtocol) finalUrl = ensureProtocol(finalUrl);

  const outbound = resolveOutboundBody(req, vars);
  return { finalUrl, headers, ...outbound };
}

/** Like `resolveOutboundRequest`, but only interpolates vars whose names are in `allowed`. */
export function resolveOutboundRequestSelected(
  req: HttpRequest,
  vars: Record<string, string>,
  autoProtocol: boolean,
  allowed: ReadonlySet<string>,
) {
  const interpolatedUrl = interpolateEnvVarsSelected(req.url, vars, allowed);
  const headers = interpolateKeyValuesSelected(req.headers, vars, allowed);
  let finalUrl = interpolatedUrl;
  if (autoProtocol) finalUrl = ensureProtocol(finalUrl);

  const outbound = resolveOutboundBodySelected(req, vars, allowed);
  return { finalUrl, headers, ...outbound };
}

export function kvToMap(kvs: KeyValue[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const kv of kvs) {
    if (kv.key && kv.enabled) map[kv.key] = kv.value;
  }
  return map;
}

export function ensureProtocol(url: string): string {
  if (!hasHttpProtocol(url)) {
    return 'http://' + url;
  }
  return url;
}
