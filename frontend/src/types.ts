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
}

export interface CollectionRequest {
  id: string;
  name: string;
  type: 'request';
  request: HttpRequest;
}

export type CollectionNode = CollectionFolder | CollectionRequest;

export interface HistoryEntry {
  id: string;
  time: string;
  method: HttpMethod;
  url: string;
  status: number;
  request: HttpRequest;
  response: HttpResponse | null;
}
