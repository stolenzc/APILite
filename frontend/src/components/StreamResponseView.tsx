import { useMemo } from 'react';
import { t } from '../i18n';
import { parseSseStream, type SseEvent } from '../utils/sseUtils';
import { isJson, formatJson } from '../utils/jsonUtils';
import CodeEditor from './CodeEditor';

export type StreamKind = 'sse' | 'ws';
export type StreamConnState = 'connected' | 'closed';

export type StreamState = {
  kind: StreamKind;
  url: string;
  state: StreamConnState;
} | null;

function eventSummary(event: SseEvent): string {
  const data = (event.data ?? '').trim();
  if (!data) return t('response.stream.emptyData');
  const oneLine = data.replace(/\s+/g, ' ');
  return oneLine.length > 120 ? `${oneLine.slice(0, 120)}…` : oneLine;
}

function EventCard({ index, event }: { index: number; event: SseEvent }) {
  const json = isJson(event.data);
  const pretty = json ? formatJson(event.data).formatted : '';
  return (
    <details className="stream-event-card">
      <summary className="stream-event-card-header">
        <span className="stream-event-index">{index + 1}#</span>
        {event.event && (
          <span className="stream-event-type" title={t('response.stream.event')}>
            {event.event}
          </span>
        )}
        {event.id && (
          <span className="stream-event-id" title={t('response.stream.id')}>
            id: {event.id}
          </span>
        )}
        {event.retry != null && (
          <span className="stream-event-retry" title={t('response.stream.retry')}>
            retry: {event.retry}
          </span>
        )}
        <span className="stream-event-preview">{eventSummary(event)}</span>
      </summary>
      <div className="stream-event-card-body">
        {json ? (
          <div className="stream-event-json">
            <CodeEditor
              value={pretty}
              language="json"
              variant="surface"
              features={{ wordWrap: true, editable: false, foldGutter: false }}
            />
          </div>
        ) : (
          <pre className="stream-event-data">{event.data || t('response.stream.emptyData')}</pre>
        )}
      </div>
    </details>
  );
}

export default function StreamResponseView({
  body,
  stream,
}: {
  body: string;
  stream: StreamState;
}) {
  // For now this view only knows how to parse SSE payloads.
  const events = useMemo(() => parseSseStream(body), [body]);

  // Keep "Connected to ..." visible even after the stream closes.
  const headerLine = stream ? t('response.stream.connected').replace('{{url}}', stream.url) : null;
  const footerLine = stream?.state === 'closed' ? t('response.stream.closed') : null;
  const hasBody = body.trim().length > 0;

  if (events.length === 0) {
    return (
      <div className="stream-response-view stream-response-view--empty">
        {headerLine ? <div className="stream-line">{headerLine}</div> : null}
        {hasBody ? <pre className="stream-event-data stream-event-data--raw">{body}</pre> : null}
        {footerLine ? <div className="stream-line stream-line--closed">{footerLine}</div> : null}
      </div>
    );
  }

  return (
    <div className="stream-response-view">
      {headerLine ? <div className="stream-line">{headerLine}</div> : null}
      <div className="stream-event-list">
        {events.map((ev, i) => (
          <EventCard key={`${i}-${ev.id ?? ''}-${ev.event ?? ''}`} index={i} event={ev} />
        ))}
      </div>
      {footerLine ? <div className="stream-line stream-line--closed">{footerLine}</div> : null}
    </div>
  );
}

