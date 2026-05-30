import type { HttpRequest } from '../types';
import { useStore } from '../store/useStore';
import { getMergedInterpolationVars } from './interpolationVars';
import { runPreScript } from './runPreScript';
import { applyRequestPatch } from './scriptProtocol';
import { resolvePreScriptId } from './normalizeRequest';
import { resolveOutboundRequestSelected } from './outboundRequest';
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
  const preScriptId = resolvePreScriptId(req);
  if (preScriptId) {
    // Critical: stale script vars must not participate in interpolation before the script runs.
    // Clear them per-send so the script result is always the only source of script vars.
    useStore.getState().clearScriptVars();
  }
  let interpolationVars = getMergedInterpolationVars();

  if (preScriptId) {
    // Phase 1: interpolate known vars so the script sees real values.
    // Unknown placeholders (typically produced by scripts) are preserved.
    const phase1Allowed = new Set(Object.keys(interpolationVars));
    const phase1Resolved = resolveOutboundRequestSelected(req, interpolationVars, false, phase1Allowed);
    const reqForScript: HttpRequest = {
      ...req,
      url: phase1Resolved.finalUrl,
      headers: phase1Resolved.headers,
      bodyType: req.bodyType,
      rawContentType: req.rawContentType,
      body: phase1Resolved.body ?? '',
      formFields: req.formFields,
      urlEncodedFields: req.urlEncodedFields,
      binaryFile: phase1Resolved.binaryFile,
    };

    const scriptResult = await runPreScript(preScriptId, reqForScript, interpolationVars, interpolationVars);
    if (!scriptResult) {
      throw new OutboundPrepareError(t('scripts.runUnavailable'));
    }
    if (!scriptResult.ok) {
      const parts = [scriptResult.error, scriptResult.stderr].filter((s) => s?.trim());
      throw new OutboundPrepareError(parts.join('\n') || t('scripts.runFailed'));
    }
    reqToSend = reqForScript;
    if (Object.keys(scriptResult.vars).length > 0) {
      interpolationVars = { ...interpolationVars, ...scriptResult.vars };
      if (options?.mergeScriptVarsIntoTab !== false) {
        useStore.getState().mergeScriptVars(scriptResult.vars);
      }

      // Phase 2: only interpolate placeholders for vars updated by the script.
      const phase2Allowed = new Set(Object.keys(scriptResult.vars));
      const phase2Resolved = resolveOutboundRequestSelected(reqToSend, interpolationVars, false, phase2Allowed);
      reqToSend = {
        ...reqToSend,
        url: phase2Resolved.finalUrl,
        headers: phase2Resolved.headers,
        body: phase2Resolved.body ?? '',
        binaryFile: phase2Resolved.binaryFile,
      };
    }
    if (scriptResult.requestPatch) {
      reqToSend = applyRequestPatch(reqToSend, scriptResult.requestPatch);
    }
  }

  return { request: reqToSend, vars: interpolationVars };
}
