import type { HttpRequest } from '../types';
import { useStore } from '../store/useStore';
import { getMergedInterpolationVars } from './interpolationVars';
import { runPreScript } from './runPreScript';
import { applyRequestPatch } from './scriptProtocol';
import { resolvePreScriptId } from './normalizeRequest';
import { t } from '../i18n';

export class OutboundPrepareError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OutboundPrepareError';
  }
}

export function getActiveHttpRequest(): HttpRequest | null {
  const state = useStore.getState();
  const tab = state.tabs.find((t) => t.id === state.activeTabId);
  return tab?.request ?? null;
}

/** Run pre-script (if bound) and return the request/vars used for HTTP and cURL export. */
export async function prepareOutboundRequest(
  req: HttpRequest,
  options?: { mergeScriptVarsIntoTab?: boolean },
): Promise<{ request: HttpRequest; vars: Record<string, string> }> {
  let reqToSend = req;
  let interpolationVars = getMergedInterpolationVars();
  const preScriptId = resolvePreScriptId(req);

  if (preScriptId) {
    const scriptResult = await runPreScript(preScriptId, req, interpolationVars, interpolationVars);
    if (!scriptResult) {
      throw new OutboundPrepareError(t('scripts.runUnavailable'));
    }
    if (!scriptResult.ok) {
      const parts = [scriptResult.error, scriptResult.stderr].filter((s) => s?.trim());
      throw new OutboundPrepareError(parts.join('\n') || t('scripts.runFailed'));
    }
    if (Object.keys(scriptResult.vars).length > 0) {
      interpolationVars = { ...interpolationVars, ...scriptResult.vars };
      if (options?.mergeScriptVarsIntoTab !== false) {
        useStore.getState().mergeScriptVars(scriptResult.vars);
      }
    }
    if (scriptResult.requestPatch) {
      reqToSend = applyRequestPatch(reqToSend, scriptResult.requestPatch);
    }
  }

  return { request: reqToSend, vars: interpolationVars };
}
