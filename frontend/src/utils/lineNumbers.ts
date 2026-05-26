/** Split text into logical lines (trailing empty line preserved). */
export function splitLogicalLines(text: string): string[] {
  if (!text) return [''];
  return text.split('\n').map((line) => line.replace(/\r$/, ''));
}

/** Line count for gutter display (empty text still shows line 1). */
export function lineCountFromText(text: string): number {
  return splitLogicalLines(text).length;
}
