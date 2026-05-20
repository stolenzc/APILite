/** Focus the collection sidebar search input. */
export function focusCollectionSearchInput(): void {
  requestAnimationFrame(() => {
    const input = document.querySelector(
      '.sidebar-collection-search-input',
    ) as HTMLInputElement | null;
    input?.focus();
    input?.select();
  });
}

export function dispatchFocusCollectionSearch(): void {
  window.dispatchEvent(new CustomEvent('app:focus-collection-search'));
}
