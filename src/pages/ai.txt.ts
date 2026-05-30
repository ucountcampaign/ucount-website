import type { APIRoute } from "astro";
import { SITE_URL } from "../lib/seo";

export const GET: APIRoute = () =>
  new Response(
    `U COUNT canonical AI reference: ${SITE_URL}/llms.txt\nFull reference: ${SITE_URL}/llms-full.txt\nSitemap: ${SITE_URL}/sitemap.xml\n`,
    {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    },
  );
