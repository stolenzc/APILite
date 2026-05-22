export interface HeaderSuggestion {
  key: string;
  description: string;
  /** Extra match terms (e.g. cors, 跨域) — not shown in UI */
  tags?: string[];
}

export const COMMON_HEADERS: HeaderSuggestion[] = [
  { key: 'Accept', description: 'Media type the client can understand' },
  { key: 'Accept-Encoding', description: 'Compression encoding (gzip, deflate, br)' },
  { key: 'Accept-Language', description: 'Preferred language (en-US, zh-CN)' },
  { key: 'Authorization', description: 'Authentication credentials (Bearer <token>)' },
  { key: 'Cache-Control', description: 'Caching directives (no-cache, no-store)' },
  { key: 'Connection', description: 'Connection control (keep-alive, close)' },
  { key: 'Content-Disposition', description: 'How to handle the response body (attachment)' },
  { key: 'Content-Encoding', description: 'Encoding of the request body' },
  { key: 'Content-Length', description: 'Size of the request body in bytes' },
  { key: 'Content-Type', description: 'Media type of the request body' },
  { key: 'Cookie', description: 'Stored HTTP cookies' },
  { key: 'Date', description: 'Date and time of the message' },
  { key: 'Host', description: 'Domain name of the server' },
  { key: 'If-Match', description: 'Conditional request with ETag' },
  { key: 'If-Modified-Since', description: 'Conditional request with timestamp' },
  { key: 'If-None-Match', description: 'Conditional request with ETag negation' },
  { key: 'If-Unmodified-Since', description: 'Conditional request unless resource changed' },
  { key: 'Range', description: 'Partial content request byte range' },
  { key: 'Referer', description: 'Previous web page URL' },
  { key: 'User-Agent', description: 'Client software identification' },

  // CORS — browser preflight & cross-origin requests
  {
    key: 'Origin',
    description: 'Source origin URL for CORS requests',
    tags: ['cors', 'cross-origin', '跨域'],
  },
  {
    key: 'Access-Control-Request-Method',
    description: 'CORS preflight: intended HTTP method',
    tags: ['cors', 'preflight', '跨域', '预检'],
  },
  {
    key: 'Access-Control-Request-Headers',
    description: 'CORS preflight: non-simple headers to send',
    tags: ['cors', 'preflight', '跨域', '预检'],
  },
  {
    key: 'Access-Control-Allow-Origin',
    description: 'CORS response: allowed origin(s)',
    tags: ['cors', 'cross-origin', '跨域'],
  },
  {
    key: 'Access-Control-Allow-Methods',
    description: 'CORS response: allowed HTTP methods',
    tags: ['cors', '跨域'],
  },
  {
    key: 'Access-Control-Allow-Headers',
    description: 'CORS response: allowed request headers',
    tags: ['cors', '跨域'],
  },
  {
    key: 'Access-Control-Allow-Credentials',
    description: 'CORS response: allow cookies / credentials',
    tags: ['cors', '跨域'],
  },
  {
    key: 'Access-Control-Expose-Headers',
    description: 'CORS response: headers visible to script',
    tags: ['cors', '跨域'],
  },
  {
    key: 'Access-Control-Max-Age',
    description: 'CORS preflight cache duration in seconds',
    tags: ['cors', 'preflight', '跨域', '预检'],
  },

  // Fetch metadata (often sent with CORS / cross-site requests)
  {
    key: 'Sec-Fetch-Mode',
    description: 'Request mode (cors, no-cors, same-origin, navigate)',
    tags: ['cors', 'fetch', '跨域'],
  },
  {
    key: 'Sec-Fetch-Site',
    description: 'Origin relationship (same-origin, cross-site, same-site)',
    tags: ['cors', 'fetch', '跨域'],
  },
  {
    key: 'Sec-Fetch-Dest',
    description: 'Request destination (empty, document, image, …)',
    tags: ['fetch'],
  },
  {
    key: 'Sec-Fetch-User',
    description: 'User-initiated navigation (?1)',
    tags: ['fetch'],
  },

  { key: 'ETag', description: 'Entity tag for cache validation' },
  { key: 'Expect', description: 'Expectation (e.g. 100-continue)' },
  { key: 'Forwarded', description: 'Proxy chain client info (for, host, proto)' },
  { key: 'Idempotency-Key', description: 'Safe retry key for duplicate requests' },
  { key: 'Last-Modified', description: 'Resource last modification time' },
  { key: 'Location', description: 'Redirect or created resource URI' },
  { key: 'Pragma', description: 'Legacy cache control (no-cache)' },
  { key: 'Proxy-Authorization', description: 'Credentials for proxy server' },
  { key: 'TE', description: 'Acceptable transfer codings' },
  { key: 'Transfer-Encoding', description: 'Chunked or other transfer encoding' },
  { key: 'Upgrade', description: 'Protocol upgrade (e.g. websocket)' },
  { key: 'Via', description: 'Intermediate proxy protocol and host' },
  { key: 'WWW-Authenticate', description: 'Authentication scheme challenge' },
  { key: 'X-Api-Key', description: 'API key for authentication' },
  { key: 'X-CSRF-Token', description: 'Cross-site request forgery token' },
  { key: 'X-Correlation-ID', description: 'Distributed tracing / correlation id' },
  { key: 'X-Forwarded-For', description: 'Client IP address through proxies' },
  { key: 'X-Forwarded-Host', description: 'Original host requested by client' },
  { key: 'X-Forwarded-Proto', description: 'Original protocol (http / https)' },
  { key: 'X-Real-IP', description: 'Client IP as seen by reverse proxy' },
  { key: 'X-Request-Id', description: 'Unique request identifier' },
  { key: 'X-Requested-With', description: 'Ajax request indicator (XMLHttpRequest)' },
];

const HEADER_MATCH_LIMIT = 15;
const HEADER_EMPTY_LIMIT = 20;

function headerSearchText(h: HeaderSuggestion): string {
  const parts = [h.key, h.description, ...(h.tags ?? [])];
  return parts.join(' ').toLowerCase();
}

function scoreHeader(h: HeaderSuggestion, q: string): number {
  const key = h.key.toLowerCase();
  const text = headerSearchText(h);

  if (key === q) return 100;
  if (key.startsWith(q)) return 90;
  if (key.replace(/-/g, '').startsWith(q.replace(/-/g, ''))) return 85;

  const segments = key.split('-');
  if (segments.some((seg) => seg.startsWith(q))) return 75;
  if (key.includes(q)) return 65;
  if (text.includes(q)) return 50;

  const corsTerms = ['cors', 'cross-origin', 'cross origin', 'preflight', '跨域', '预检'];
  if (corsTerms.some((term) => q.includes(term)) && (h.tags?.includes('cors') || key.includes('access-control') || key === 'origin')) {
    return 45;
  }

  return 0;
}

export function matchHeaders(query: string): HeaderSuggestion[] {
  const q = query.trim().toLowerCase();
  if (!q) return COMMON_HEADERS.slice(0, HEADER_EMPTY_LIMIT);

  return COMMON_HEADERS
    .map((h) => ({ h, score: scoreHeader(h, q) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.h.key.localeCompare(b.h.key))
    .map((x) => x.h)
    .slice(0, HEADER_MATCH_LIMIT);
}

export const methodColors: Record<string, string> = {
  GET: 'var(--get)',
  POST: 'var(--post)',
  PUT: 'var(--put)',
  DELETE: 'var(--delete)',
  PATCH: 'var(--patch)',
  HEAD: 'var(--head)',
  OPTIONS: 'var(--options)',
};
