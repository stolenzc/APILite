/** Focus the folder sidebar search input. */
export function focusFolderSearchInput(): void {
  requestAnimationFrame(() => {
    const input = document.querySelector<HTMLInputElement>(
      '.sidebar-folder-search-input',
    );
    input?.focus();
    input?.select();
  });
}

export function dispatchFocusFolderSearch(): void {
  window.dispatchEvent(new CustomEvent('app:focus-folder-search'));
}
