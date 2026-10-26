import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

type CmsResult = { elapsed: number; settings: { siteName: string }; section: { title: string } };
type CatalogResult = {
  home: { products: { slug: string }[]; collections: { name: string }[] };
  shop: { products: { slug: string }[] };
  calls: Record<string, number>;
};
type TimedResult = { elapsed: number; value: string };

test("Cloudflare retains late Wix refreshes and rejects PHP probes before Wix reads", { timeout: 45000 }, async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "ucount-cache-test-"));
  const config = join(directory, "wrangler.json");
  await writeFile(config, JSON.stringify({
    name: "ucount-cache-local-verification",
    main: fileURLToPath(new URL("./fixtures/cache-worker.ts", import.meta.url)),
    compatibility_date: "2026-04-15",
    define: { "import.meta.env": "{}" },
    alias: { "astro:middleware": fileURLToPath(new URL("../node_modules/astro/dist/core/middleware/index.js", import.meta.url)) },
    vars: { WIX_DATA_API_KEY: "local-fixture-key", WIX_STORES_API_KEY: "local-fixture-key", WIX_EVENTS_API_KEY: "local-fixture-key", WIX_FORMS_API_KEY: "local-fixture-key" },
  }));
  const child = spawn(process.execPath, [
    fileURLToPath(new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url)),
    "dev", "--config", config, "--local", "--ip", "127.0.0.1", "--port", "0",
  ], { env: { ...process.env, WRANGLER_SEND_METRICS: "false" }, stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  const capture = (chunk: Buffer) => { output = (output + chunk.toString()).slice(-12000); };
  child.stdout.on("data", capture);
  child.stderr.on("data", capture);
  t.after(async () => {
    child.kill("SIGTERM");
    await Promise.race([once(child, "exit"), sleep(2000)]);
    await rm(directory, { recursive: true, force: true });
  });
  let origin: string | undefined;
  for (let attempt = 0; attempt < 150; attempt++) {
    origin = output.match(/Ready on (http:\/\/127\.0\.0\.1:\d+)/)?.[1];
    if (origin) break;
    if (child.exitCode !== null) assert.fail(output);
    await sleep(100);
  }
  assert.ok(origin, output);
  const get = async <T>(path: string): Promise<T> => {
    const response = await fetch(origin + path, { signal: AbortSignal.timeout(10000) });
    assert.equal(response.status, 200, await response.clone().text());
    return response.json();
  };

  await get("/configure?productDelay=5000");
  const canonicalPaths = ["/llms-full.txt", "/sitemap.xml", "/product"];
  const unavailable = await Promise.all(canonicalPaths.map(path => fetch(origin + path)));
  for (const response of unavailable) {
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("cache-control"), "no-store");
  }
  await sleep(1300);
  for (const path of canonicalPaths) {
    const response: Response = await fetch(origin + path);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /fixture-product/);
  }
  await get("/configure?productDelay=0");
  const primary = await get<CmsResult>("/cms");
  assert.equal(primary.settings.siteName, "Primary Wix fixture");
  assert.equal(primary.section.title, "Verified CMS title");
  const catalog = await get<CatalogResult>("/catalog");
  assert.equal(catalog.home.products[0].slug, "fixture-product");
  assert.equal(catalog.shop.products[0].slug, "fixture-product");
  assert.equal(catalog.calls["/stores-reader/v1/products/query-platformized"], 2);
  const calls = await get<Record<string, number>>("/stats");
  for (const [path, status] of [["/product-page/wp-login.php", 404], ["/event-details/index%2ePHP/path", 404], ["/%FF", 400]] as const) {
    assert.equal((await fetch(origin + path)).status, status);
  }
  assert.deepEqual(await get("/stats"), calls);

  for (const path of ["/api/contact", "/api/checkout"]) {
    const invalid: Response = await fetch(origin + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    assert.equal(invalid.status, 400);
  }
  assert.deepEqual(await get("/stats"), calls);
  const submit = (path: string, values: Record<string, string>) => fetch(origin + path, {
    method: "POST", body: new URLSearchParams(values), redirect: "manual",
  });
  const sent = await submit("/api/contact", { firstName: "Fixture", email: "fixture@example.test", message: "Local test" });
  assert.equal(sent.status, 303);
  assert.equal(sent.headers.get("location"), "/contact?status=sent");
  const cart = await submit("/api/checkout", { productId: "fixture-product", productSlug: "fixture-product", quantity: "1" });
  assert.equal(cart.status, 303);
  assert.equal(cart.headers.get("location"), "https://checkout.ucountcampaign.org/checkout?checkoutId=fixture");

  await get("/configure?delay=5000&title=Updated%20CMS%20title&advance=61000");
  const stale = await get<CmsResult>("/cms");
  assert.ok(stale.elapsed >= 3900 && stale.elapsed < 4800, JSON.stringify(stale));
  assert.equal(stale.section.title, "Verified CMS title");
  assert.equal((await get<CmsResult>("/cms")).section.title, "Verified CMS title");
  await sleep(1300);
  assert.equal((await get<CmsResult>("/cms")).section.title, "Updated CMS title");

  const cold = await get<TimedResult>("/slow?key=cold");
  assert.equal(cold.value, "page fallback");
  assert.ok(cold.elapsed >= 3900 && cold.elapsed < 4800, JSON.stringify(cold));
  await sleep(1300);
  assert.equal((await get<TimedResult>("/slow?key=cold")).value, "late primary source");
  await get("/configure?eventDelay=4500");
  assert.equal((await fetch(origin + "/event?slug=slow-event")).status, 503);
  await sleep(700);
  assert.equal((await get<{ id: string }>("/event?slug=slow-event")).id, "fixture-event");
  await get("/configure");
  assert.equal((await get<{ id: string }>("/event")).id, "fixture-event");
  await get("/configure?malformedEvents&advance=61000");
  assert.equal((await get<{ id: string }>("/event")).id, "fixture-event");
  await get("/configure?eventDeleted=true&advance=31000");
  assert.equal(await get("/event"), null);
  for (const failure of ["truncatedProducts", "failedCollections"]) {
    await get(`/configure?${failure}&advance=61000`);
    const retained = await get<CatalogResult>("/catalog");
    assert.equal(retained.home.products[0].slug, "fixture-product");
    assert.equal(retained.home.collections[0].name, "Fixture category");
  }
});
