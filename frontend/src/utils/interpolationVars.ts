import { useEnvironmentStore } from '../store/useEnvironmentStore';
import { useStore } from '../store/useStore';

/** Environment variables plus script output vars from the active tab (script overrides env). */
export function getMergedInterpolationVars(): Record<string, string> {
  const env = useEnvironmentStore.getState().getActiveVarMap();
  const tab = useStore.getState().tabs.find((t) => t.id === useStore.getState().activeTabId);
  const scriptVars = tab?.scriptVars ?? {};
  return { ...env, ...scriptVars };
}
