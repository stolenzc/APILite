export interface KeyValue {
  key: string;
  value: string;
  enabled: boolean;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export type BodyType = 'none' | 'form-data' | 'x-www-form-urlencoded' | 'raw' | 'binary';

export type RawContentType = 'json' | 'xml' | 'text' | 'javascript' | 'html';

export type FormFieldType = 'text' | 'file';

export interface FormField {
  key: string;
  value: string;
  enabled: boolean;
  fieldType: FormFieldType;
  /** Original file name for display / multipart filename. */
  fileName?: string;
  /** Local path (Tauri) for upload without loading into memory. */
  filePath?: string;
  /** Base64 payload when no path (browser or tree persistence). */
  fileDataBase64?: string;
}

export interface BinaryBodyFile {
  fileName: string;
  filePath?: string;
  fileDataBase64?: string;
}

export interface HttpRequest {
  method: HttpMethod;
  url: string;
  params: KeyValue[];
  headers: KeyValue[];
  bodyType: BodyType;
  rawContentType: RawContentType;
  body: string;
  /** multipart/form-data fields */
  formFields: FormField[];
  /** application/x-www-form-urlencoded fields */
  urlEncodedFields: KeyValue[];
  /** application/octet-stream file body */
  binaryFile: BinaryBodyFile | null;
  /** Pre-request script id from scripts.json (shared across requests). */
  preScriptId: string | null;
}

export interface ScriptEntry {
  id: string;
  name: string;
  description: string;
  file: string;
  updatedAt: number;
}

export interface ScriptsManifest {
  version: number;
  scripts: ScriptEntry[];
}

export interface HttpResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  raw?: string;
  durationMs: number;
}

export interface TreeFolder {
  id: string;
  name: string;
  type: 'folder';
  children: TreeNode[];
  collapsed: boolean;
  /** Disk JSON filename (e.g. `My API.json`); only on top-level folders. */
  fileName?: string;
}

export interface TreeRequest {
  id: string;
  name: string;
  type: 'request';
  request: HttpRequest;
  /** Manual order among sibling requests (folders are sorted by name). */
  sortOrder?: number;
}

export type TreeNode = TreeFolder | TreeRequest;

export interface HistoryEntry {
  id: string;
  /** Unix ms — used for retention and sorting. */
  timestamp: number;
  /** Locale display string derived from timestamp. */
  time: string;
  method: HttpMethod;
  url: string;
  status: number;
  /** Raw HTTP request as sent (request line + headers + body). */
  requestRaw: string;
  /** Raw HTTP response (status line + headers + body). */
  responseRaw: string | null;
}
