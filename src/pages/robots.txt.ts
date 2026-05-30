import type { APIRoute } from "astro";
import { SITE_URL } from "../lib/seo";

export const GET: APIRoute = () => {
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
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    `Host: ${SITE_URL}`,
    "",
  ];

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
