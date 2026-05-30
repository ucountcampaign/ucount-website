import type { APIRoute } from "astro";
import { getSiteUrl } from "../lib/seo";

export const GET: APIRoute = ({ url }) => {
  const siteUrl = getSiteUrl(url.origin);
  const privatePaths = ["/api/"];
  const aiBots = [
    "GPTBot",
    "ChatGPT-User",
    "OAI-SearchBot",
    "ClaudeBot",
    "Claude-SearchBot",
    "PerplexityBot",
  ];

  const lines = [
    "User-agent: *",
    "Allow: /",
    ...privatePaths.map((path) => `Disallow: ${path}`),
    "",
    ...aiBots.flatMap((bot) => [
      `User-agent: ${bot}`,
      "Allow: /",
      ...privatePaths.map((path) => `Disallow: ${path}`),
      "",
    ]),
    `Sitemap: ${siteUrl}/sitemap.xml`,
    `Host: ${siteUrl}`,
    "",
  ];

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
