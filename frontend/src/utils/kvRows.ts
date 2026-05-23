import type { FormField, KeyValue } from '../types';

export function isKeyValueRowEmpty(row: Pick<KeyValue, 'key' | 'value'>): boolean {
  return !row.key.trim() && !row.value.trim();
}

export function isFormFieldRowEmpty(row: FormField): boolean {
  if (row.key.trim()) return false;
  if (row.fieldType === 'file') {
    return !(row.fileName || row.filePath || row.fileDataBase64 || row.value.trim());
  }
  return !row.value.trim();
}

/**
 * Postman-style: keep exactly one trailing empty row.
 * Drops other empty rows (e.g. after clearing input) and appends one when the last row has content.
 */
export function withTrailingEmptyRow<T extends Pick<KeyValue, 'key' | 'value'>>(
  rows: T[],
  createEmpty: () => T,
  isEmpty: (row: T) => boolean = isKeyValueRowEmpty,
): T[] {
  const filled = rows.filter((r) => !isEmpty(r));
  return [...filled, createEmpty()];
}

export function withTrailingFormFieldRow(
  rows: FormField[],
  createEmpty: () => FormField,
): FormField[] {
  return withTrailingEmptyRow(rows, createEmpty, isFormFieldRowEmpty);
}
