import type { HttpResponse } from '../types';

/** Reconstruct raw HTTP response text when not provided by the backend (e.g. history). */
export function formatRawHttpResponse(
  response: Pick<HttpResponse, 'status' | 'statusText' | 'headers' | 'body'>,
): string {
  const statusLine = response.statusText
    ? `HTTP/1.1 ${response.status} ${response.statusText}\r\n`
    : `HTTP/1.1 ${response.status}\r\n`;

  const headerLines = Object.entries(response.headers)
    .map(([k, v]) => `${k}: ${v}\r\n`)
    .join('');

  return `${statusLine}${headerLines}\r\n${response.body}`;
}

export function getRawHttpResponse(response: HttpResponse): string {
  return response.raw || formatRawHttpResponse(response);
}
