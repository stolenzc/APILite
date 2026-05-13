export interface KeyValue {
  key: string;
  value: string;
  enabled: boolean;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export type BodyType = 'none' | 'raw' | 'json' | 'xml' | 'text' | 'html' | 'form-data' | 'x-www-form-urlencoded';

export interface HttpRequest {
  method: HttpMethod;
  url: string;
  params: KeyValue[];
  headers: KeyValue[];
  bodyType: BodyType;
  body: string;
}

export interface HttpResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  durationMs: number;
}

export interface HistoryEntry {
  id: string;
  time: string;
  method: HttpMethod;
  url: string;
  status: number;
  request: HttpRequest;
}
