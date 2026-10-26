import { siteCache, siteCacheErrorTtlMs, siteCacheStaleTtlMs, siteCacheTtlMs } from "./cache.ts";

type Snapshot<T> = {
  value: T;
  freshUntil: number;
  staleUntil: number;
};

type Refresh<T> = {
  promise: Promise<T>;
  startedAt: number;
  slowReported: boolean;
};

type Entry<T> = {
  snapshot?: Snapshot<T>;
  refresh?: Refresh<T>;
  retryAt: number;
  error?: unknown;
};

type CacheOptions = {
  background: (task: Promise<unknown>) => void;
  onError: (key: string, error: unknown) => void;
  staleTtlMs?: number;
};

// Each key keeps its last successful value separate from the in-flight refresh.
export function createReadCache({ background, onError, staleTtlMs = siteCacheStaleTtlMs }: CacheOptions) {
  const entries = new Map<string, Entry<unknown>>();

  return async function read<T>(key: string, load: (signal: AbortSignal) => Promise<T>): Promise<T> {
    let entry = entries.get(key) as Entry<T> | undefined;

    if (!entry) {
      // Product and event slugs come from URLs, so bound the number of keys.
      if (entries.size >= siteCache.maxEntries) {
        entries.delete(entries.keys().next().value!);
      }
      entry = { retryAt: 0 };
      entries.set(key, entry);
    }

    const current = entry;
    const usableSnapshot = () => {
      const snapshot = current.snapshot;
      return snapshot && snapshot.staleUntil > Date.now() ? snapshot : undefined;
    };

    if (current.snapshot && current.snapshot.freshUntil > Date.now()) {
      return current.snapshot.value;
    }

    if (!current.refresh && current.retryAt > Date.now()) {
      const snapshot = usableSnapshot();
      if (snapshot) return snapshot.value;
      throw current.error;
    }

    if (!current.refresh) {
      const controller = new AbortController();
      let timeout: ReturnType<typeof setTimeout>;
      const deadline = new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          const error = new Error(`Wix refresh exceeded ${siteCache.refreshTimeoutSeconds} seconds`);
          controller.abort(error);
          reject(error);
        }, siteCache.refreshTimeoutSeconds * 1000);
      });
      const refresh: Refresh<T> = {
        startedAt: Date.now(),
        slowReported: false,
        promise: Promise.race([Promise.resolve().then(() => load(controller.signal)), deadline])
          .then((value) => {
            const now = Date.now();
            current.snapshot = {
              value,
              freshUntil: now + siteCacheTtlMs,
              staleUntil: now + staleTtlMs,
            };
            current.retryAt = 0;
            current.error = undefined;
            return value;
          }, (error: unknown) => {
            current.error = error;
            current.retryAt = Date.now() + siteCacheErrorTtlMs;
            onError(key, error);
            throw error;
          })
          .finally(() => {
            clearTimeout(timeout);
            current.refresh = undefined;
          }),
      };
      current.refresh = refresh;
      // Workers must retain the refresh after the page returns cached content.
      background(refresh.promise.catch(() => {}));
    }

    const refresh = current.refresh;
    const remainingMs = Math.max(0, refresh.startedAt + siteCache.readWaitSeconds * 1000 - Date.now());

    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        const error = new Error(`Wix read exceeded ${siteCache.readWaitSeconds} seconds`);
        if (!refresh.slowReported) {
          refresh.slowReported = true;
          onError(key, error);
        }
        const snapshot = usableSnapshot();
        if (snapshot) resolve(snapshot.value);
        else reject(error);
      }, remainingMs);

      refresh.promise.then((value) => {
        clearTimeout(timeout);
        resolve(value);
      }, (error: unknown) => {
        clearTimeout(timeout);
        const snapshot = usableSnapshot();
        if (snapshot) resolve(snapshot.value);
        else reject(error);
      });
    });
  };
}
