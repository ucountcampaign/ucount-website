// @ts-check
import { defineConfig } from "astro/config";
import vercel from "@astrojs/vercel";
import tailwindcss from "@tailwindcss/vite";

const siteHost =
  process.env.PUBLIC_SITE_URL ||
  process.env.SITE_URL ||
  process.env.VERCEL_URL ||
  "http://localhost:4321";
const site = (/^https?:\/\//i.test(siteHost) ? siteHost : `https://${siteHost}`).replace(
  /\/+$/,
  "",
);

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
