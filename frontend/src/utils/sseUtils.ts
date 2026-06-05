export interface SseEvent {
  id?: string;
  event?: string;
  data: string;
  retry?: number;
}

function decodeUnicodeEscapes(input: string): string {
  // Decode literal \uXXXX sequences (including surrogate pairs) commonly seen in SSE payloads.
  const s = input;
  return s.replace(/\\u([0-9a-fA-F]{4})/g, (_m, hex: string, offset: number) => {
    const hi = parseInt(hex, 16);
    if (hi >= 0xd800 && hi <= 0xdbff) {
      const next = s.slice(offset + 6, offset + 12);
      const m2 = next.match(/^\\u([0-9a-fA-F]{4})/);
      if (m2) {
        const low = parseInt(m2[1], 16);
        if (low >= 0xdc00 && low <= 0xdfff) {
          const cp = (hi - 0xd800) * 0x400 + (low - 0xdc00) + 0x10000;
          return String.fromCodePoint(cp);
        }
      }
    }
    return String.fromCharCode(hi);
  });
}

function headerValue(headers: Record<string, string>, name: string): string | undefined {
  const entry = Object.entries(headers).find(([k]) => k.toLowerCase() === name.toLowerCase());
  return entry?.[1];
}

/** True when Content-Type is SSE or the body looks like an SSE stream. */
export function isSseResponse(headers: Record<string, string>, body: string): boolean {
  const ct = headerValue(headers, 'content-type') ?? '';
  if (ct.toLowerCase().includes('text/event-stream')) return true;
  const trimmed = body.trim();
  if (!trimmed) return false;
  if (!/^data:/m.test(trimmed)) return false;
  return trimmed.includes('\n\n') || /^event:/m.test(trimmed) || /^id:/m.test(trimmed);
}

/** Parse SSE stream text into discrete events (W3C Server-Sent Events). */
export function parseSseStream(text: string): SseEvent[] {
  const events: SseEvent[] = [];
  let current: Partial<SseEvent> & { dataLines?: string[] } = {};

  const flush = () => {
    const hasPayload =
      (current.dataLines && current.dataLines.length > 0) ||
      current.event != null ||
      current.id != null ||
      current.retry != null;
    if (!hasPayload) {
      current = {};
      return;
    }
    events.push({
      id: current.id,
      event: current.event,
      data: decodeUnicodeEscapes(current.dataLines?.join('\n') ?? ''),
      retry: current.retry,
    });
    current = {};
  };

  const lines = text.replace(/\r\n/g, '\n').split('\n');
  for (const line of lines) {
    if (line === '') {
      flush();
      continue;
    }
    if (line.startsWith(':')) continue;

    const colon = line.indexOf(':');
    if (colon === -1) continue;

    const field = line.slice(0, colon);
    let value = line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);

    switch (field) {
      case 'data':
        if (!current.dataLines) current.dataLines = [];
        current.dataLines.push(value);
        break;
      case 'event':
        current.event = value;
        break;
      case 'id':
        current.id = value;
        break;
      case 'retry': {
        const n = Number(value);
        if (!Number.isNaN(n)) current.retry = n;
        break;
      }
      default:
        break;
    }
  }
  flush();
  return events;
}
