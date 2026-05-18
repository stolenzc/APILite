export function showToast(message: string) {
  window.dispatchEvent(new CustomEvent('app:toast', { detail: message }));
}
