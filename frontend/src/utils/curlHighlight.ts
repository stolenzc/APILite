const SINGLE_QUOTED_RE = /'(?:\\'|[^'])*'/g;
const CURL_X_METHOD_RE = /(-X)\s+(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\b/g;
const CURL_FLAG_RE = /(^|\s)(-[A-Za-z]+|--[a-z][a-z0-9-]*)/g;
const CURL_CONT_RE = / \\$/gm;
/** Only the shell command, not substrings inside injected class names. */
const CURL_CMD_RE = /(^|\s)curl\b/g;

const PH_RE = /<!--CURLH([a-z]+)-->/g;

function commentIndexSlug(n: number): string {
  let s = '';
  let v = n + 1;
  while (v > 0) {
    v -= 1;
    s = String.fromCharCode(97 + (v % 26)) + s;
    v = Math.floor(v / 26);
  }
  return s;
}

function slugToIndex(slug: string): number {
  let n = 0;
  for (const ch of slug) {
    n = n * 26 + (ch.charCodeAt(0) - 97 + 1);
  }
  return n - 1;
}

function stringPlaceholder(idx: number): string {
  return `<!--CURLH${commentIndexSlug(idx)}-->`;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function highlightCurl(input: string): string {
  const escaped = escapeHtml(input);
  const stringSlots: string[] = [];

  const withoutStrings = escaped.replace(SINGLE_QUOTED_RE, (s) => {
    const idx = stringSlots.length;
    stringSlots.push(s);
    return stringPlaceholder(idx);
  });

  let html = withoutStrings
    .replace(CURL_CMD_RE, (_, prefix) => `${prefix}<span class="curl-cmd">curl</span>`)
    .replace(
      CURL_X_METHOD_RE,
      (_, flag, method: string) =>
        `<span class="curl-flag">${flag}</span> <span class="curl-method curl-method-${method.toLowerCase()}">${method}</span>`,
    )
    .replace(
      CURL_FLAG_RE,
      (_, prefix, flag) => `${prefix}<span class="curl-flag">${flag}</span>`,
    )
    .replace(CURL_CONT_RE, ' <span class="curl-cont">\\</span>');

  html = html.replace(PH_RE, (_, slug) => {
    const s = stringSlots[slugToIndex(slug)] ?? '';
    return `<span class="curl-string">${s}</span>`;
  });

  return html;
}
