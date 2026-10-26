import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import { test, type TestContext } from "node:test";
import { createReadCache } from "../src/lib/read-cache.ts";
import { siteCache, siteCacheStaleTtlMs, siteCacheTtlMs } from "../src/lib/cache.ts";

function setup(t: TestContext, staleTtlMs?: number) {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 0 });
  const background: Promise<unknown>[] = [];
  const errors: unknown[] = [];
  const read = createReadCache({
    background: (task) => { background.push(task); },
    onError: (_key, error) => { errors.push(error); },
    staleTtlMs,
  });
  return { read, background, errors };
}

test("concurrent readers share a load and fresh hits use the successful value", async (t) => {
  const { read } = setup(t);
  let loads = 0;
  const source = Promise.withResolvers<string>();
  const load = () => { loads++; return source.promise; };
  const first = read("home", load);
  const second = read("home", load);
  await setImmediate();
  assert.equal(loads, 1);
  source.resolve("published content");
  assert.deepEqual(await Promise.all([first, second]), ["published content", "published content"]);
  t.mock.timers.tick(siteCacheTtlMs - 1);
  assert.equal(await read("home", load), "published content");
  assert.equal(loads, 1);
});

test("a fast refresh returns new content and starts its TTL on completion", async (t) => {
  const { read } = setup(t);
  await read("home", async () => "old");
  t.mock.timers.tick(siteCacheTtlMs);
  const source = Promise.withResolvers<string>();
  const result = read("home", () => source.promise);
  t.mock.timers.tick(3000);
  source.resolve("new");
  assert.equal(await result, "new");
  t.mock.timers.tick(siteCacheTtlMs - 1);
  assert.equal(await read("home", async () => "too soon"), "new");
});

test("a slow refresh returns old content at four seconds and saves the late success", async (t) => {
  const { read, background, errors } = setup(t);
  await read("home", async () => "old");
  t.mock.timers.tick(siteCacheTtlMs);
  const source = Promise.withResolvers<string>();
  let loads = 0;
  const load = () => { loads++; return source.promise; };
  const first = read("home", load);
  await setImmediate();
  t.mock.timers.tick(4000);
  assert.equal(await first, "old");
  const next = read("home", load);
  t.mock.timers.tick(0);
  assert.equal(await next, "old");
  assert.equal(loads, 1);
  assert.equal(errors.length, 1);
  source.resolve("updated after response");
  await Promise.all(background);
  assert.equal(await read("home", load), "updated after response");
});

test("a cold slow read exits at four seconds but a late result still warms the cache", async (t) => {
  const { read, background } = setup(t);
  const source = Promise.withResolvers<string>();
  const result = assert.rejects(read("home", () => source.promise), /read exceeded 4 seconds/);
  await setImmediate();
  t.mock.timers.tick(4000);
  await result;
  source.resolve("first successful value");
  await Promise.all(background);
  assert.equal(await read("home", async () => "unused"), "first successful value");
});

test("failed refreshes retain good content and back off before trying Wix again", async (t) => {
  const { read } = setup(t);
  await read("home", async () => "old");
  t.mock.timers.tick(siteCacheTtlMs);
  let loads = 0;
  const fail = async () => { loads++; throw new Error("Wix unavailable"); };
  assert.equal(await read("home", fail), "old");
  assert.equal(await read("home", fail), "old");
  assert.equal(loads, 1);
  t.mock.timers.tick(siteCache.errorTtlSeconds * 1000);
  assert.equal(await read("home", async () => "recovered"), "recovered");
});

test("cold failures back off without caching a fallback as successful content", async (t) => {
  const { read } = setup(t);
  let loads = 0;
  const fail = async () => { loads++; throw new Error("Wix unavailable"); };
  await assert.rejects(read("home", fail), /Wix unavailable/);
  await assert.rejects(read("home", fail), /Wix unavailable/);
  assert.equal(loads, 1);
  t.mock.timers.tick(siteCache.errorTtlSeconds * 1000);
  assert.equal(await read("home", async () => "recovered"), "recovered");
});

test("a hung loader is aborted at twenty seconds and cannot overwrite a later refresh", async (t) => {
  const { read, background } = setup(t);
  const source = Promise.withResolvers<string>();
  let signal: AbortSignal | undefined;
  const result = assert.rejects(read("home", (refreshSignal) => {
    signal = refreshSignal;
    return source.promise;
  }), /read exceeded/);
  await setImmediate();
  t.mock.timers.tick(4000);
  await result;
  assert.equal(signal?.aborted, false);
  t.mock.timers.tick(16000);
  await Promise.all(background);
  assert.equal(signal?.aborted, true);
  t.mock.timers.tick(siteCache.errorTtlSeconds * 1000);
  assert.equal(await read("home", async () => "recovered"), "recovered");
  source.resolve("obsolete result");
  await setImmediate();
  assert.equal(await read("home", async () => "unused"), "recovered");
});

test("content that expires while waiting is never served beyond the stale limit", async (t) => {
  const { read, background } = setup(t);
  await read("home", async () => "old");
  t.mock.timers.tick(siteCacheStaleTtlMs - 1000);
  const source = Promise.withResolvers<string>();
  const result = assert.rejects(read("home", () => source.promise), /read exceeded/);
  await setImmediate();
  t.mock.timers.tick(4000);
  await result;
  source.reject(new Error("unavailable"));
  await Promise.all(background);
  await assert.rejects(read("home", async () => "unused"), /unavailable/);
});

test("product stock reads fail closed after their original sixty-second TTL", async (t) => {
  const { read, background } = setup(t, siteCacheTtlMs);
  await read("product", async () => ({ inStock: true }));
  t.mock.timers.tick(siteCacheTtlMs);
  const source = Promise.withResolvers<{ inStock: boolean }>();
  const result = assert.rejects(read("product", () => source.promise), /read exceeded/);
  await setImmediate();
  t.mock.timers.tick(4000);
  await result;
  source.resolve({ inStock: false });
  await Promise.all(background);
  assert.deepEqual(await read("product", async () => ({ inStock: true })), { inStock: false });
});

test("successful empty values are cached and URL-driven keys have a size limit", async (t) => {
  const { read } = setup(t);
  assert.equal(await read("missing", async () => null), null);
  assert.equal(await read("missing", async () => "unused"), null);
  for (let i = 0; i < siteCache.maxEntries; i++) {
    assert.deepEqual(await read(`product:${i}`, async () => []), []);
  }
  assert.equal(await read("missing", async () => "loaded again after eviction"), "loaded again after eviction");
});
