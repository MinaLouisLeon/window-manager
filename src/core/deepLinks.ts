import type { AppId } from './types';

/** A parsed deep link: the app to open and the remaining query parameters. */
export interface DeepLink {
  appId: AppId;
  params: Record<string, string>;
}

function searchOf(url: string | URL | URLSearchParams): URLSearchParams {
  if (url instanceof URLSearchParams) return url;
  if (typeof url !== 'string') return url.searchParams;
  const hash = url.indexOf('#');
  const withoutHash = hash === -1 ? url : url.slice(0, hash);
  const question = withoutHash.indexOf('?');
  return new URLSearchParams(question === -1 ? withoutHash : withoutHash.slice(question + 1));
}

/**
 * Reads `?open=<appId>&<params>` from a URL, a query string (with or without the leading `?`) or
 * URLSearchParams. Returns null when there is no `open` parameter. A repeated parameter keeps its
 * first value.
 */
export function parseDeepLink(url: string | URL | URLSearchParams): DeepLink | null {
  const search = searchOf(url);
  const appId = search.get('open');
  if (appId === null || appId === '') return null;
  const entries = new Map<string, string>();
  for (const [key, value] of search) {
    if (key !== 'open' && !entries.has(key)) entries.set(key, value);
  }
  return { appId, params: Object.fromEntries(entries) };
}

/** Builds the query string `?open=<appId>&<params>`. A `params` key named `open` is ignored. */
export function buildDeepLink(appId: AppId, params: Record<string, string> = {}): string {
  const search = new URLSearchParams();
  search.set('open', appId);
  for (const [key, value] of Object.entries(params)) {
    if (key !== 'open') search.append(key, value);
  }
  return `?${search.toString()}`;
}
