import type { KeyValue } from '../types';

function extractQueryString(url: string): string {
  const qIdx = url.indexOf('?');
  if (qIdx === -1) return '';
  let qs = url.slice(qIdx + 1);
  const hashIdx = qs.indexOf('#');
  if (hashIdx !== -1) qs = qs.slice(0, hashIdx);
  return qs;
}

/** Parse query segments as literal text (no '+' or '%' transforms). */
export function parseQueryString(qs: string): Array<{ key: string; value: string }> {
  if (!qs) return [];
  const out: Array<{ key: string; value: string }> = [];
  for (const segment of qs.split('&')) {
    if (!segment) continue;
    const eq = segment.indexOf('=');
    const key = eq === -1 ? segment : segment.slice(0, eq);
    const value = eq === -1 ? '' : segment.slice(eq + 1);
    out.push({ key, value });
  }
  return out;
}

export function parseParamsFromUrl(url: string): KeyValue[] {
  return parseQueryString(extractQueryString(url)).map(({ key, value }) => ({
    key,
    value,
    enabled: true,
  }));
}

/** Rebuild query from param rows without encoding (for Params tab → address bar sync). */
export function urlWithParams(url: string, params: KeyValue[]): string {
  const baseUrl = url.split('?')[0];
  const active = params.filter((p) => p.key && p.enabled);
  if (active.length === 0) return baseUrl;
  const qs = active.map((p) => `${p.key}=${p.value}`).join('&');
  return `${baseUrl}?${qs}`;
}
