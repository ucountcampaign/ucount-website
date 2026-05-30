import type { APIRoute } from "astro";
import { getEvents } from "../lib/wix-events";
import { getStorefrontProducts } from "../lib/wix-store";
import { SITE_URL, absoluteUrl } from "../lib/seo";

type SitemapEntry = {
  loc: string;
  lastmod?: string;
  changefreq?: "daily" | "weekly" | "monthly" | "yearly";
  priority?: number;
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function sitemapEntry(entry: SitemapEntry): string {
  return [
    "  <url>",
    `    <loc>${escapeXml(entry.loc)}</loc>`,
    entry.lastmod ? `    <lastmod>${entry.lastmod}</lastmod>` : "",
    entry.changefreq ? `    <changefreq>${entry.changefreq}</changefreq>` : "",
    typeof entry.priority === "number"
      ? `    <priority>${entry.priority.toFixed(1)}</priority>`
      : "",
    "  </url>",
  ]
    .filter(Boolean)
    .join("\n");
}

export const GET: APIRoute = async () => {
  const now = new Date().toISOString();
  const [storefront, events] = await Promise.all([
    getStorefrontProducts(),
    getEvents(),
  ]);
  const staticEntries: SitemapEntry[] = [
    { loc: `${SITE_URL}/`, changefreq: "weekly", priority: 1 },
    { loc: absoluteUrl("/shop"), changefreq: "daily", priority: 0.9 },
    { loc: absoluteUrl("/events"), changefreq: "daily", priority: 0.8 },
    { loc: absoluteUrl("/about"), changefreq: "monthly", priority: 0.7 },
    { loc: absoluteUrl("/contact"), changefreq: "monthly", priority: 0.6 },
  ];
  const productEntries: SitemapEntry[] = storefront.products.map((product) => ({
    loc: absoluteUrl(product.url),
    lastmod: product.createdDate || now,
    changefreq: "weekly",
    priority: 0.7,
  }));
  const eventEntries: SitemapEntry[] = events.allEvents.map((event) => ({
    loc: absoluteUrl(event.detailHref),
    lastmod: event.startDateTime || now,
    changefreq: event.lifecycle === "upcoming" ? "daily" : "yearly",
    priority: event.lifecycle === "upcoming" ? 0.7 : 0.4,
  }));
  const entries = [...staticEntries, ...productEntries, ...eventEntries];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map(sitemapEntry).join("\n")}
</urlset>
`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
    },
  });
};
