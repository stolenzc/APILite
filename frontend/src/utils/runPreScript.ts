import { invoke } from '@tauri-apps/api/core';
import type { HttpRequest } from '../types';
import { isTauri } from '../tauri/setupMenu';
import { resolveDataDir } from './storagePaths';
import {
  buildPreScriptPayload,
  parseScriptRunResult,
  type ScriptRunResult,
} from './scriptProtocol';

export async function runPreScript(
  scriptId: string,
  request: HttpRequest,
  env: Record<string, string>,
  vars: Record<string, string>,
): Promise<ScriptRunResult | null> {
  if (!isTauri()) return null;
  const dataDir = await resolveDataDir();
  if (!dataDir) return null;

  const payload = buildPreScriptPayload(request, env, vars);
  const raw = await invoke<{
    ok: boolean;
    vars?: Record<string, unknown>;
    request?: Record<string, unknown> | null;
    error?: string | null;
    stderr?: string | null;
    duration_ms: number;
  }>('scripts_run_pre', {
    dataDir,
    scriptId,
    payloadJson: payload,
  });

  return parseScriptRunResult(raw);
}
