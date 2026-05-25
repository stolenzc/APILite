import { hasHttpProtocol } from './envInterpolation';

/** Path after host, without query or hash (e.g. `/api/login`). */
function formatPathForSave(pathname: string): string {
  if (!pathname || pathname === '/') return '';
  try {
    const decoded = decodeURI(pathname);
    return decoded.length > 1 && decoded.endsWith('/') ? decoded.slice(0, -1) : decoded;
  } catch {
    return pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  }
}

function pathFromUrlFallback(url: string): string {
  const noQuery = url.split(/[?#]/)[0] ?? url;
  const proto = noQuery.indexOf('://');
  const rest = proto === -1 ? noQuery : noQuery.slice(proto + 3);
  const slash = rest.indexOf('/');
  return slash === -1 ? '/' : rest.slice(slash);
}

/** Host path for default save name (no query string). */
export function defaultRequestNameFromUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';

  try {
    const normalized = hasHttpProtocol(trimmed) ? trimmed : `http://${trimmed}`;
    const { pathname, hostname } = new URL(normalized);
    const path = formatPathForSave(pathname);
    return path || hostname || '';
  } catch {
    return formatPathForSave(pathFromUrlFallback(trimmed));
  }
}
