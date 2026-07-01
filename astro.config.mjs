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

  image: {
    domains: ["static.wixstatic.com"],
  },

  vite: {
    plugins: [tailwindcss()],
  },
});
