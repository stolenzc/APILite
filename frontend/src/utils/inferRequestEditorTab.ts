import type { HttpRequest } from '../types';
import { isFormFieldRowEmpty, isKeyValueRowEmpty } from './kvRows';

export type RequestEditorTab = 'params' | 'headers' | 'body' | 'script';

function hasEnabledKv(rows: { key: string; value: string; enabled: boolean }[] | undefined): boolean {
  return (rows ?? []).some((r) => r.enabled && !isKeyValueRowEmpty(r));
}

function hasBodyContent(req: HttpRequest): boolean {
  switch (req.bodyType) {
    case 'none':
      return false;
    case 'raw':
      return (req.body ?? '').trim().length > 0;
    case 'binary':
      return req.binaryFile != null;
    case 'form-data':
      return (req.formFields ?? []).some((f) => f.enabled && !isFormFieldRowEmpty(f));
    case 'x-www-form-urlencoded':
      return hasEnabledKv(req.urlEncodedFields);
    default:
      return false;
  }
}

/** Default request editor tab when opening a saved request: body → params → headers. */
export function inferDefaultRequestEditorTab(req: HttpRequest): RequestEditorTab {
  if (hasBodyContent(req)) return 'body';
  if (hasEnabledKv(req.params)) return 'params';
  if (hasEnabledKv(req.headers)) return 'headers';
  return 'params';
}
