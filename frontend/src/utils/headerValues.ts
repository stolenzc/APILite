export interface HeaderValueSuggestion {
  value: string;
  description?: string;
}

/** Common preset values keyed by normalized header name (lowercase). */
export const HEADER_VALUE_PRESETS: Record<string, HeaderValueSuggestion[]> = {
  accept: [
    { value: '*/*', description: 'Any media type' },
    { value: 'application/json' },
    { value: 'text/html' },
    { value: 'application/xml' },
  ],
  'accept-encoding': [
    { value: 'gzip, deflate, br' },
    { value: 'gzip' },
    { value: 'deflate' },
    { value: 'br' },
  ],
  'accept-language': [
    { value: 'en-US,en;q=0.9' },
    { value: 'zh-CN,zh;q=0.9' },
    { value: 'en-US' },
    { value: 'zh-CN' },
  ],
  authorization: [
    { value: 'Bearer ', description: 'OAuth / JWT token' },
    { value: 'Basic ', description: 'Base64 user:password' },
  ],
  'cache-control': [
    { value: 'no-cache' },
    { value: 'no-store' },
    { value: 'max-age=3600' },
    { value: 'must-revalidate' },
  ],
  connection: [{ value: 'keep-alive' }, { value: 'close' }],
  'content-encoding': [{ value: 'gzip' }, { value: 'deflate' }, { value: 'br' }],
  'content-type': [
    { value: 'application/json' },
    { value: 'application/x-www-form-urlencoded' },
    { value: 'multipart/form-data' },
    { value: 'text/plain' },
    { value: 'text/html' },
    { value: 'application/xml' },
    { value: 'application/octet-stream' },
  ],
  expect: [{ value: '100-continue' }],
  pragma: [{ value: 'no-cache' }],
  te: [{ value: 'trailers' }, { value: 'gzip' }],
  'transfer-encoding': [{ value: 'chunked' }],
  upgrade: [{ value: 'websocket' }],
  range: [{ value: 'bytes=0-' }],
  'if-none-match': [{ value: '*' }],
  'access-control-allow-origin': [{ value: '*' }, { value: 'null' }],
  'access-control-allow-credentials': [{ value: 'true' }, { value: 'false' }],
  'access-control-allow-methods': [
    { value: 'GET, POST, PUT, DELETE, OPTIONS' },
    { value: 'GET, POST, OPTIONS' },
  ],
  'access-control-allow-headers': [
    { value: 'Content-Type, Authorization' },
    { value: 'Content-Type' },
  ],
  'access-control-request-method': [
    { value: 'GET' },
    { value: 'POST' },
    { value: 'PUT' },
    { value: 'DELETE' },
    { value: 'PATCH' },
    { value: 'OPTIONS' },
  ],
  'access-control-request-headers': [
    { value: 'content-type' },
    { value: 'authorization' },
    { value: 'content-type, authorization' },
  ],
  'access-control-max-age': [{ value: '86400' }, { value: '3600' }],
  'sec-fetch-mode': [
    { value: 'cors' },
    { value: 'no-cors' },
    { value: 'same-origin' },
    { value: 'navigate' },
  ],
  'sec-fetch-site': [
    { value: 'same-origin' },
    { value: 'same-site' },
    { value: 'cross-site' },
    { value: 'none' },
  ],
  'sec-fetch-dest': [
    { value: 'empty' },
    { value: 'document' },
    { value: 'image' },
    { value: 'script' },
    { value: 'style' },
  ],
  'sec-fetch-user': [{ value: '?1' }],
  'x-requested-with': [{ value: 'XMLHttpRequest' }],
  'www-authenticate': [{ value: 'Bearer' }, { value: 'Basic' }],
};

const MATCH_LIMIT = 15;
const EMPTY_LIMIT = 12;

function normalizeHeaderKey(key: string): string {
  return key.trim().toLowerCase();
}

function scoreHeaderValue(v: HeaderValueSuggestion, q: string): number {
  const val = v.value.toLowerCase();
  const desc = (v.description ?? '').toLowerCase();

  if (val === q) return 100;
  if (val.startsWith(q)) return 90;
  if (val.includes(q)) return 70;
  if (desc.includes(q)) return 50;
  return 0;
}

export function matchHeaderValues(headerKey: string, query: string): HeaderValueSuggestion[] {
  const presets = HEADER_VALUE_PRESETS[normalizeHeaderKey(headerKey)];
  if (!presets?.length) return [];

  const q = query.trim().toLowerCase();
  if (!q) return presets.slice(0, EMPTY_LIMIT);

  return presets
    .map((v) => ({ v, score: scoreHeaderValue(v, q) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.v.value.localeCompare(b.v.value))
    .map((x) => x.v)
    .slice(0, MATCH_LIMIT);
}
