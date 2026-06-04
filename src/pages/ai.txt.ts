import type { APIRoute } from "astro";
import { getSiteUrl } from "../lib/seo";
import { publicCacheControl } from "../lib/cache";

export const GET: APIRoute = ({ url }) => {
  const siteUrl = getSiteUrl(url.origin);

  return new Response(
    `U COUNT canonical AI reference: ${siteUrl}/llms.txt\nFull reference: ${siteUrl}/llms-full.txt\nSitemap: ${siteUrl}/sitemap.xml\n`,
    {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": publicCacheControl,
      },
    },
  );
};
