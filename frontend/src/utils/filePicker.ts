import { isTauri } from '../tauri/setupMenu';

export async function pickFilePath(): Promise<string | null> {
  if (!isTauri()) return null;
  try {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const selected = await open({ multiple: false });
    if (typeof selected === 'string') return selected;
    return null;
  } catch {
    return null;
  }
}

export function readBrowserFileAsBase64(file: File): Promise<{ fileName: string; fileDataBase64: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Failed to read file'));
        return;
      }
      const comma = result.indexOf(',');
      const base64 = comma >= 0 ? result.slice(comma + 1) : result;
      resolve({ fileName: file.name, fileDataBase64: base64 });
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}
