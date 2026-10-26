import { waitUntil } from "cloudflare:workers";
import { createReadCache } from "./read-cache";

export type WixReadOptions = { strict?: boolean };

export function wixUnavailableResponse() {
  return new Response(null, {
    status: 503,
    headers: { "Cache-Control": "no-store", "Retry-After": "5" },
  });
}

export function createWixReadCache(staleTtlMs?: number) {
  return createReadCache({
    background: waitUntil,
    onError: (key, error) => console.error("Wix read failed or exceeded its page budget", { key, error }),
    staleTtlMs,
  });
}

// Give every HTTP request in a paginated SDK read the same refresh deadline.
export function wixReadFetch(signal: AbortSignal): typeof fetch {
  return (input, init) => {
    const signals = [signal];
    if (init?.signal) signals.push(init.signal);
    if (input instanceof Request) signals.push(input.signal);
    return fetch(input, { ...init, signal: AbortSignal.any(signals) });
  };
}
