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

/** Postman-style: keep one trailing empty row; append when the last row has content. */
export function withTrailingEmptyRow<T extends Pick<KeyValue, 'key' | 'value'>>(
  rows: T[],
  createEmpty: () => T,
  isEmpty: (row: T) => boolean = isKeyValueRowEmpty,
): T[] {
  if (rows.length === 0) return [createEmpty()];
  const last = rows[rows.length - 1];
  if (isEmpty(last)) return rows;
  return [...rows, createEmpty()];
}

export function withTrailingFormFieldRow(
  rows: FormField[],
  createEmpty: () => FormField,
): FormField[] {
  return withTrailingEmptyRow(rows, createEmpty, isFormFieldRowEmpty);
}
