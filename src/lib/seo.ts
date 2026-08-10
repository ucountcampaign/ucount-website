import type { EventItem } from "./wix-events";
import type { PageContent, ResolvedSiteSettings } from "./wix-cms";
import type { StoreProductCard, StoreProductDetail } from "./wix-store";
import { resolveWixImageUrl } from "./images";

function normalizeSiteUrl(value: string | undefined): string {
  const trimmed = value?.trim().replace(/\/+$/, "") ?? "";

  if (!trimmed) {
    return "";
  }

  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

const configuredSiteUrl = normalizeSiteUrl(
  import.meta.env.PUBLIC_SITE_URL ||
  import.meta.env.SITE_URL ||
    import.meta.env.CF_PAGES_URL,
);

export const SITE_URL = configuredSiteUrl || "http://localhost:4321";

export const SOCIAL_IMAGE_WIDTH = 1200;
export const SOCIAL_IMAGE_HEIGHT = 630;
export const DEFAULT_SOCIAL_IMAGE = "/assets/ucount-logo-social.png";
export const DEFAULT_SOCIAL_IMAGE_ALT =
  "U COUNT anti-trafficking work through prevention, awareness, restoration, and marketplace support";

export type SeoMeta = {
  description?: string;
  canonicalPath?: string;
  image?: string;
  imageAlt?: string;
  imageWidth?: number;
  imageHeight?: number;
  type?: string;
  keywords?: string[];
  noindex?: boolean;
  schemaType?: "WebPage" | "AboutPage" | "ContactPage" | "CollectionPage" | "ItemPage";
};

type BreadcrumbItem = {
  name: string;
  path: string;
};

function compact(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function stripTags(value: string | null | undefined): string {
  return compact((value ?? "").replace(/<[^>]*>/g, " "));
}

export function truncateDescription(value: string, maxLength = 160): string {
  const clean = compact(value);

  if (clean.length <= maxLength) {
    return clean;
  }

  const clipped = clean.slice(0, maxLength - 3).trim();
  const wordBoundary = clipped.replace(/\s+\S*$/, "").trim();

  return `${wordBoundary || clipped}...`;
}

export function getSiteUrl(fallbackOrigin?: string): string {
  return configuredSiteUrl || normalizeSiteUrl(fallbackOrigin) || SITE_URL;
}

export function absoluteUrl(path = "/", siteUrl = SITE_URL): string {
  const baseUrl = siteUrl.replace(/\/+$/, "");

  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  if (path.startsWith("#")) {
    return `${baseUrl}/${path}`;
  }

  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

export function openGraphWixImageUrl(
  imageUrl: string | null | undefined,
  {
    width = SOCIAL_IMAGE_WIDTH,
    height = SOCIAL_IMAGE_HEIGHT,
    quality = 85,
  }: { width?: number; height?: number; quality?: number } = {},
): string {
  const resolvedImageUrl = resolveWixImageUrl(imageUrl);

  if (!resolvedImageUrl) {
    return "";
  }

  try {
    const url = new URL(resolvedImageUrl);

    if (!url.hostname.endsWith("wixstatic.com")) {
      return resolvedImageUrl;
    }

    const mediaId = url.pathname.match(/\/media\/([^/]+)/i)?.[1];

    if (!mediaId) {
      return resolvedImageUrl;
    }

    return `https://static.wixstatic.com/media/${mediaId}/v1/fill/w_${width},h_${height},al_c,q_${quality},enc_auto/file.jpg`;
  } catch {
    return resolvedImageUrl;
  }
}

export function resolveSocialImageMeta(
  content: PageContent | null | undefined,
): Pick<SeoMeta, "image" | "imageAlt"> {
  const socialImage = content?.socialImage?.trim();

  if (!socialImage) {
    return { image: DEFAULT_SOCIAL_IMAGE, imageAlt: DEFAULT_SOCIAL_IMAGE_ALT };
  }

  return {
    image: openGraphWixImageUrl(socialImage),
    imageAlt: content?.socialImageAlt?.trim() || DEFAULT_SOCIAL_IMAGE_ALT,
  };
}

export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

function postalAddress(site: ResolvedSiteSettings) {
  const [cityState = "", postalCode = ""] = site.cityStateZip.split(/\s+(?=\d{5})/);
  const [addressLocality = "Fort Collins", addressRegion = "CO"] = cityState
    .split(",")
    .map((part) => part.trim());

  return {
    "@type": "PostalAddress",
    streetAddress: site.streetAddress,
    addressLocality,
    addressRegion,
    postalCode,
    addressCountry: "US",
  };
}

export function organizationSchema(site: ResolvedSiteSettings, siteUrl = SITE_URL) {
  const sameAs = [site.facebookUrl, site.instagramUrl].filter(Boolean);

  return {
    "@context": "https://schema.org",
    "@type": ["Organization", "NGO"],
    "@id": `${siteUrl}/#organization`,
    name: site.siteName,
    alternateName: "U COUNT Campaign",
    url: siteUrl,
    logo: absoluteUrl("/assets/ucount-logo.png", siteUrl),
    image: absoluteUrl(DEFAULT_SOCIAL_IMAGE, siteUrl),
    description: site.organizationSummary,
    foundingDate: "2007",
    nonprofitStatus: "https://schema.org/Nonprofit501c3",
    taxID: site.ein,
    email: site.mainEmail,
    address: postalAddress(site),
    areaServed: [
      { "@type": "Place", name: "Fort Collins, Colorado" },
      { "@type": "Place", name: "Worldwide" },
    ],
    sameAs,
    knowsAbout: [
      "Human trafficking prevention",
      "Human trafficking awareness",
      "Survivor restoration",
      "Volunteer anti-trafficking work",
      "Freedom supply chain",
      "Ethical marketplace goods",
    ],
    potentialAction: {
      "@type": "DonateAction",
      target: site.primaryDonateUrl,
      recipient: { "@id": `${siteUrl}/#organization` },
    },
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "general inquiries",
      email: site.mainEmail,
      areaServed: "US",
      availableLanguage: "English",
    },
  };
}

export function websiteSchema(site: ResolvedSiteSettings, siteUrl = SITE_URL) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${siteUrl}/#website`,
    name: site.siteName,
    url: siteUrl,
    inLanguage: "en-US",
    publisher: { "@id": `${siteUrl}/#organization` },
  };
}

export function webPageSchema({
  title,
  description,
  path,
  schemaType = "WebPage",
  siteUrl = SITE_URL,
}: {
  title: string;
  description: string;
  path: string;
  schemaType?: SeoMeta["schemaType"];
  siteUrl?: string;
}) {
  const url = absoluteUrl(path, siteUrl);

  return {
    "@context": "https://schema.org",
    "@type": schemaType,
    "@id": `${url}#webpage`,
    name: title,
    description,
    url,
    inLanguage: "en-US",
    isPartOf: { "@id": `${siteUrl}/#website` },
    publisher: { "@id": `${siteUrl}/#organization` },
  };
}

export function breadcrumbSchema(items: BreadcrumbItem[], siteUrl = SITE_URL) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path, siteUrl),
    })),
  };
}

export function productSchema(
  product: StoreProductDetail | StoreProductCard,
  siteUrl = SITE_URL,
) {
  const url = absoluteUrl(product.url, siteUrl);

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${url}#product`,
    name: product.name,
    description:
      "fullDescription" in product && product.fullDescription
        ? product.fullDescription
        : product.description,
    image: product.image ? absoluteUrl(product.image, siteUrl) : undefined,
    url,
    brand: {
      "@type": "Brand",
      name: "U COUNT Marketplace",
    },
    category: product.categoryNames.join(", ") || "Marketplace goods",
    offers:
      typeof product.priceValue === "number"
        ? {
            "@type": "Offer",
            price: product.priceValue,
            priceCurrency: "USD",
            availability: product.inStock
              ? "https://schema.org/InStock"
              : "https://schema.org/OutOfStock",
            url,
            seller: { "@id": `${siteUrl}/#organization` },
          }
        : undefined,
  };
}

export function productItemListSchema(products: StoreProductCard[], siteUrl = SITE_URL) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "U COUNT Marketplace products",
    itemListElement: products.map((product, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: absoluteUrl(product.url, siteUrl),
      item: productSchema(product, siteUrl),
    })),
  };
}

export function eventSchema(event: EventItem, siteUrl = SITE_URL) {
  const url = absoluteUrl(event.detailHref, siteUrl);
  const address = event.addressLines.length
    ? {
        "@type": "PostalAddress",
        streetAddress: event.addressLines.join(", "),
      }
    : undefined;

  return {
    "@context": "https://schema.org",
    "@type": "Event",
    "@id": `${url}#event`,
    name: event.title,
    description: event.description || event.summary,
    url,
    image: absoluteUrl(event.image, siteUrl),
    startDate: event.startDateTime,
    endDate: event.endDateTime || undefined,
    eventStatus:
      event.lifecycle === "past"
        ? "https://schema.org/EventCompleted"
        : "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    organizer: { "@id": `${siteUrl}/#organization` },
    location: {
      "@type": "Place",
      name: event.venueName,
      address,
    },
    offers: event.registrationHref
      ? {
          "@type": "Offer",
          url: event.registrationHref,
          availability: event.registrationAvailable
            ? "https://schema.org/InStock"
            : "https://schema.org/SoldOut",
        }
      : undefined,
  };
}

export function eventItemListSchema(events: EventItem[], siteUrl = SITE_URL) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "U COUNT events",
    itemListElement: events.map((event, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: absoluteUrl(event.detailHref, siteUrl),
      item: eventSchema(event, siteUrl),
    })),
  };
}
