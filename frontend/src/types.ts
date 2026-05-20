export interface KeyValue {
  key: string;
  value: string;
  enabled: boolean;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export type BodyType = 'none' | 'form-data' | 'x-www-form-urlencoded' | 'raw' | 'binary';

export type RawContentType = 'json' | 'xml' | 'text' | 'javascript' | 'html';

export interface HttpRequest {
  method: HttpMethod;
  url: string;
  params: KeyValue[];
  headers: KeyValue[];
  bodyType: BodyType;
  rawContentType: RawContentType;
  body: string;
}

export interface HttpResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  raw?: string;
  durationMs: number;
}

export interface CollectionFolder {
  id: string;
  name: string;
  type: 'folder';
  children: CollectionNode[];
  collapsed: boolean;
  /** Set only on top-level collection roots (one `.json` file each). */
  fileName?: string;
}

export interface CollectionRequest {
  id: string;
  name: string;
  type: 'request';
  request: HttpRequest;
  /** Manual order among sibling requests (folders are sorted by name). */
  sortOrder?: number;
}

export type CollectionNode = CollectionFolder | CollectionRequest;

export interface HistoryEntry {
  id: string;
  time: string;
  method: HttpMethod;
  url: string;
  status: number;
  /** Raw HTTP request as sent (request line + headers + body). */
  requestRaw: string;
  /** Raw HTTP response (status line + headers + body). */
  responseRaw: string | null;
}
