import { invoke } from '@tauri-apps/api/core';
import { useStore } from '../store/useStore';
import { isCurlCommand } from './curlUtils';
import { showToast } from './toast';
import { t } from '../i18n';

export type ParsedCurl = {
  method: string;
  url: string;
  headers: [string, string][];
  body: string | null;
};

export async function parseAndApplyCurlCommand(command: string): Promise<boolean> {
  const trimmed = command.trim();
  if (!isCurlCommand(trimmed)) return false;
  try {
    const parsed: ParsedCurl = await invoke('parse_curl', { command: trimmed });
    useStore.getState().applyParsedCurl(parsed);
    return true;
  } catch (err) {
    showToast(`${t('url.curlParseError')}: ${err}`);
    return false;
  }
}
