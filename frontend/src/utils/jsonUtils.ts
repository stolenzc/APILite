export function formatJson(input: string): { formatted: string; valid: boolean } {
  try {
    const parsed = JSON.parse(input);
    return { formatted: JSON.stringify(parsed, null, 2), valid: true };
  } catch {
    return { formatted: input, valid: false };
  }
}

export function isJson(input: string): boolean {
  try {
    JSON.parse(input);
    return true;
  } catch {
    return false;
  }
}

// Simple regex-based JSON syntax highlighter
// Returns HTML-like string with <span class="json-*"> wrappers
// Groups: 1=key, 2=colon ws, 3=string, 4=bool/null, 5=number, 6=punctuation
const JSON_TOKEN_RE = /("(?:\\.|[^"\\])*")(\s*:\s*)|("(?:\\.|[^"\\])*")|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|([{}[\],])/g;

export function highlightJson(input: string): string {
  // Escape HTML first
  const escaped = input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return escaped.replace(JSON_TOKEN_RE, (match, key, colon, stringVal, bool, number, punct) => {
    if (key !== undefined) return `<span class="json-key">${key}</span>${colon}`;
    if (stringVal !== undefined) return `<span class="json-string">${stringVal}</span>`;
    if (bool !== undefined) return `<span class="json-bool">${bool}</span>`;
    if (number !== undefined) return `<span class="json-number">${number}</span>`;
    if (punct !== undefined) return `<span class="json-punct">${punct}</span>`;
    return match;
  });
}
