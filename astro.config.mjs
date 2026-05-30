// @ts-check
import { defineConfig } from "astro/config";
import vercel from "@astrojs/vercel";
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

  adapter: vercel(),

  image: {
    domains: ["static.wixstatic.com"],
  },

  vite: {
    plugins: [tailwindcss()],
  },
});
