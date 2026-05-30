import type { RawContentType } from '../types';

export function isCurlCommand(text: string): boolean {
  const t = text.trim();
  if (/^curl(\.exe)?(\s+|$)/i.test(t)) return true;
  if (/\binvoke-(webrequest|restmethod)\b/i.test(t)) return true;
  if (/^\s*(iwr|irm)(\s+|$)/i.test(t)) return true;
  return false;
}

export function inferRawContentType(contentType: string): RawContentType {
  const ct = contentType.toLowerCase();
  if (ct.includes('xml')) return 'xml';
  if (ct.includes('html')) return 'html';
  if (ct.includes('javascript')) return 'javascript';
  if (ct.includes('text/plain') || (ct.startsWith('text/') && !ct.includes('json'))) return 'text';
  return 'json';
}
