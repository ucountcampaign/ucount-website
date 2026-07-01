import { env as cloudflareEnv } from "cloudflare:workers";

type RuntimeEnv = Record<string, unknown>;

export function getEnv(name: string): string {
  const runtimeValue = (cloudflareEnv as RuntimeEnv)[name];
  const buildValue = import.meta.env[name];
  const value = runtimeValue ?? buildValue;

  return typeof value === "string" ? value.trim() : "";
}

