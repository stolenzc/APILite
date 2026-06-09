/** Focus the request environment picker in the toolbar. */
export function focusEnvironmentSelect(): void {
  requestAnimationFrame(() => {
    const trigger = document.querySelector<HTMLElement>('.request-env-select');
    trigger?.focus();
  });
}
