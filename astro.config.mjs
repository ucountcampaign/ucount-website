// @ts-check
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import tailwindcss from "@tailwindcss/vite";

const siteHost =
  process.env.PUBLIC_SITE_URL ||
  process.env.SITE_URL ||
  process.env.CF_PAGES_URL ||
  "http://localhost:4321";
const site = (/^https?:\/\//i.test(siteHost) ? siteHost : `https://${siteHost}`).replace(
  /\/+$/,
  "",
);

// https://astro.build/config
export default defineConfig({
  site,
  output: "server",

  adapter: cloudflare({
    imageService: "passthrough",
  }),

  // Nothing in this site reads or writes Astro.session. Left unset, the
  // Cloudflare adapter defaults the session store to a KV binding named
  // SESSION and emits it into the generated wrangler.json without an id.
  // `wrangler versions upload` then tries to provision that namespace on
  // every deploy and fails once it exists:
  //
  //   Creating new KV Namespace "ucount-website-session"...
  //   a namespace with this account ID and title already exists [code: 10014]
  //
  // Naming a non-KV driver keeps the binding out of the generated config, so
  // no KV resource is requested and there is nothing to provision. If session
  // state is ever actually needed, swap this for the KV driver and declare the
  // namespace with an explicit id in wrangler.jsonc rather than relying on
  // auto-provisioning.
  session: {
    driver: { entrypoint: "unstorage/drivers/memory" },
  },

  image: {
    domains: ["static.wixstatic.com"],
  },

  vite: {
    plugins: [tailwindcss()],
  },
});
