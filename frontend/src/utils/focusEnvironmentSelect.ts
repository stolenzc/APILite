/** Focus the request environment <select> in the toolbar. */
export function focusEnvironmentSelect(): void {
  requestAnimationFrame(() => {
    const select = document.querySelector<HTMLSelectElement>('.request-env-select');
    select?.focus();
  });
}
