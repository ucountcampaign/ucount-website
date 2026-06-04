export const siteCache = {
  ttlSeconds: 60,
  staleWhileRevalidateSeconds: 60 * 60,
  errorTtlSeconds: 30,
} as const;

export const siteCacheTtlMs = siteCache.ttlSeconds * 1000;
export const siteCacheStaleTtlMs =
  siteCache.staleWhileRevalidateSeconds * 1000;
export const siteCacheErrorTtlMs = siteCache.errorTtlSeconds * 1000;

export const publicCacheControl = [
  "public",
  `max-age=${siteCache.ttlSeconds}`,
  `s-maxage=${siteCache.ttlSeconds}`,
  `stale-while-revalidate=${siteCache.staleWhileRevalidateSeconds}`,
].join(", ");

export function setPublicCacheControl(headers: Headers): void {
  headers.set("Cache-Control", publicCacheControl);
}
