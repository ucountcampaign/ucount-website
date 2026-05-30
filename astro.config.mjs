// @ts-check
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import tailwindcss from "@tailwindcss/vite";

const site = (
  process.env.PUBLIC_SITE_URL ||
  process.env.SITE_URL ||
  "https://ucountcampaign.org"
).replace(/\/+$/, "");

// https://astro.build/config
export default defineConfig({
  site,
  output: "server",

  adapter: cloudflare(),

  image: {
    domains: ["static.wixstatic.com"],
  },

  vite: {
    plugins: [tailwindcss()],
  },
});
