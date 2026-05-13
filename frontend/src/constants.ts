export interface HeaderSuggestion {
  key: string;
  description: string;
}

export const COMMON_HEADERS: HeaderSuggestion[] = [
  { key: 'Accept', description: 'Media type the client can understand' },
  { key: 'Accept-Encoding', description: 'Compression encoding (gzip, deflate, br)' },
  { key: 'Accept-Language', description: 'Preferred language (en-US, zh-CN)' },
  { key: 'Authorization', description: 'Authentication credentials (Bearer <token>)' },
  { key: 'Cache-Control', description: 'Caching directives (no-cache, no-store)' },
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
  { key: 'Origin', description: 'Origin of the request (CORS)' },
  { key: 'Referer', description: 'Previous web page URL' },
  { key: 'User-Agent', description: 'Client software identification' },
  { key: 'X-Api-Key', description: 'API key for authentication' },
  { key: 'X-CSRF-Token', description: 'Cross-site request forgery token' },
  { key: 'X-Forwarded-For', description: 'Client IP address through proxies' },
  { key: 'X-Request-Id', description: 'Unique request identifier' },
  { key: 'X-Requested-With', description: 'Ajax request indicator (XMLHttpRequest)' },
];

export function matchHeaders(query: string): HeaderSuggestion[] {
  if (!query) return COMMON_HEADERS;
  const q = query.toLowerCase();
  return COMMON_HEADERS.filter(
    h => h.key.toLowerCase().includes(q) || h.description.toLowerCase().includes(q)
  ).slice(0, 10);
}
