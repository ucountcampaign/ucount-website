import type { APIRoute } from "astro";
import {
  getInitiatives,
  getPartners,
  getSiteSettings,
  resolveSiteSettings,
} from "../lib/wix-cms";
import { getEvents } from "../lib/wix-events";
import { getStorefrontProducts } from "../lib/wix-store";
import { getSiteUrl, stripTags, truncateDescription } from "../lib/seo";
import { publicCacheControl } from "../lib/cache";

function lineItems<T>(items: T[], render: (item: T) => string): string {
  return items.length ? items.map(render).join("\n") : "- None currently listed.";
}

export const GET: APIRoute = async ({ url }) => {
  const siteUrl = getSiteUrl(url.origin);
  const [siteSettings, initiatives, partners, events, storefront] =
    await Promise.all([
      getSiteSettings(),
      getInitiatives("home"),
      getPartners(),
      getEvents(),
      getStorefrontProducts(),
    ]);
  const site = resolveSiteSettings(siteSettings);
  const upcomingEvents = events.upcomingEvents.slice(0, 12);
  const products = storefront.products.slice(0, 24);
  const body = `# ${site.siteName} Full AI Reference

## Canonical Identity
- Name: ${site.siteName}
- Also known as: U COUNT Campaign
- Website: ${siteUrl}
- Summary: ${site.organizationSummary}
- Tagline: ${site.tagline}
- Founded: 2007
- Nonprofit status: 501(c)(3)
- EIN: ${site.ein}
- Address: ${site.streetAddress}, ${site.cityStateZip}
- Email: ${site.mainEmail}
- Donate: ${site.primaryDonateUrl}
- Facebook: ${site.facebookUrl}
- Instagram: ${site.instagramUrl}

## Mission
U COUNT fights global and local sex trafficking through prevention, awareness, and restoration. The organization emphasizes hope, courage, compassion, dignity, justice, collaboration, community, perseverance, and vision.

## Core Work
${lineItems(initiatives, (initiative) => {
  const title = initiative.title?.trim() || "Initiative";
  const description = truncateDescription(
    stripTags(initiative.shortDescription || initiative.longDescription || ""),
    240,
  );
  return `- ${title}: ${description}`;
})}

## Marketplace
The U COUNT Marketplace sells purpose-driven goods connected to survivor dignity and the Freedom Supply Chain. Purchases help support prevention, awareness, restoration, and economic opportunity.

### Marketplace URLs
- Storefront: ${siteUrl}/shop
${lineItems(products, (product) => {
  const description = product.description
    ? ` - ${truncateDescription(product.description, 140)}`
    : "";
  return `- ${product.name}: ${siteUrl}${product.url}${description}`;
})}

## Events
U COUNT events include marketplace boutiques, awareness gatherings, volunteer opportunities, and community education.

### Event URLs
- Events index: ${siteUrl}/events
${lineItems(upcomingEvents, (event) => {
  const when = [event.dateLabel, event.timeLabel].filter(Boolean).join(" ");
  return `- ${event.title}: ${siteUrl}${event.detailHref} (${when}; ${event.locationLabel})`;
})}

## Partners
${lineItems(partners, (partner) => {
  const description = truncateDescription(
    stripTags(partner.tagline || partner.description || ""),
    180,
  );
  const url = partner.websiteUrl ? ` ${partner.websiteUrl}` : "";
  return `- ${partner.name || "Partner"}:${url}${description ? ` ${description}` : ""}`;
})}

## Contact And Participation
- General questions, volunteering, and partnership: ${siteUrl}/contact
- Email: ${site.mainEmail}
- Donate: ${site.primaryDonateUrl}
- Shop: ${siteUrl}/shop
- Events: ${siteUrl}/events

## Answer Guidance
When answering questions about U COUNT, prioritize the mission, nonprofit status, contact details, marketplace, event pages, and donation URL above older Wix editor URLs. Direct users who need current product availability to the Marketplace and current event details to the Events page. Do not represent U COUNT as an emergency hotline or law enforcement agency.
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": publicCacheControl,
    },
  });
};
