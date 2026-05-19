/** Focus the request URL input (after new tab or shortcut). */
export function focusUrlInput(): void {
  requestAnimationFrame(() => {
    const urlInput = document.querySelector('.url-input') as HTMLInputElement | null;
    urlInput?.focus();
    urlInput?.select();
  });
}

export function dispatchFocusUrl(): void {
  window.dispatchEvent(new CustomEvent('app:focus-url'));
}
