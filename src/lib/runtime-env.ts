import { env as cloudflareEnv } from "cloudflare:workers";
import { WIX_CONFIG_DEFAULTS } from "./wix-config";

type RuntimeEnv = Record<string, unknown>;

export function getEnv(name: string): string {
  const runtimeValue = (cloudflareEnv as RuntimeEnv)[name];
  const buildValue = import.meta.env[name];
  const value = runtimeValue ?? buildValue;
  const resolved = typeof value === "string" ? value.trim() : "";

  // Non-secret identifiers fall back to their committed defaults so the site
  // works without any per-environment configuration. An explicit runtime or
  // build-time value still wins.
  return resolved || (WIX_CONFIG_DEFAULTS[name] ?? "");
}

