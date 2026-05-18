import type { RawContentType } from '../types';

export function isCurlCommand(text: string): boolean {
  return /^curl(\s+|$)/i.test(text.trim());
}

export function inferRawContentType(contentType: string): RawContentType {
  const ct = contentType.toLowerCase();
  if (ct.includes('xml')) return 'xml';
  if (ct.includes('html')) return 'html';
  if (ct.includes('javascript')) return 'javascript';
  if (ct.includes('text/plain') || (ct.startsWith('text/') && !ct.includes('json'))) return 'text';
  return 'json';
}
