import type { EventItem } from "./wix-events";
import type { ResolvedSiteSettings } from "./wix-cms";
import type { StoreProductCard, StoreProductDetail } from "./wix-store";

export const SITE_URL = (
  import.meta.env.PUBLIC_SITE_URL ||
  import.meta.env.SITE_URL ||
  "https://ucountcampaign.org"
).replace(/\/+$/, "");

export const DEFAULT_SOCIAL_IMAGE = "/assets/events/ucount-marketplace-boutique-borderless.jpg";
export const DEFAULT_SOCIAL_IMAGE_ALT =
  "U COUNT marketplace goods supporting anti-trafficking prevention, awareness, and restoration";

export type SeoMeta = {
  description?: string;
  canonicalPath?: string;
  image?: string;
  imageAlt?: string;
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

export function absoluteUrl(path = "/"): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  if (path.startsWith("#")) {
    return `${SITE_URL}/${path}`;
  }

  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
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

export function organizationSchema(site: ResolvedSiteSettings) {
  const sameAs = [site.facebookUrl, site.instagramUrl].filter(Boolean);

  return {
    "@context": "https://schema.org",
    "@type": ["Organization", "NGO"],
    "@id": `${SITE_URL}/#organization`,
    name: site.siteName,
    alternateName: "U COUNT Campaign",
    url: SITE_URL,
    logo: absoluteUrl("/assets/ucount-logo.jpg"),
    image: absoluteUrl(DEFAULT_SOCIAL_IMAGE),
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
      recipient: { "@id": `${SITE_URL}/#organization` },
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

export function websiteSchema(site: ResolvedSiteSettings) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: site.siteName,
    url: SITE_URL,
    inLanguage: "en-US",
    publisher: { "@id": `${SITE_URL}/#organization` },
  };
}

export function webPageSchema({
  title,
  description,
  path,
  schemaType = "WebPage",
}: {
  title: string;
  description: string;
  path: string;
  schemaType?: SeoMeta["schemaType"];
}) {
  const url = absoluteUrl(path);

  return {
    "@context": "https://schema.org",
    "@type": schemaType,
    "@id": `${url}#webpage`,
    name: title,
    description,
    url,
    inLanguage: "en-US",
    isPartOf: { "@id": `${SITE_URL}/#website` },
    publisher: { "@id": `${SITE_URL}/#organization` },
  };
}

export function breadcrumbSchema(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function productSchema(product: StoreProductDetail | StoreProductCard) {
  const url = absoluteUrl(product.url);

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${url}#product`,
    name: product.name,
    description:
      "fullDescription" in product && product.fullDescription
        ? product.fullDescription
        : product.description,
    image: product.image ? absoluteUrl(product.image) : undefined,
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
            seller: { "@id": `${SITE_URL}/#organization` },
          }
        : undefined,
  };
}

export function productItemListSchema(products: StoreProductCard[]) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "U COUNT Marketplace products",
    itemListElement: products.map((product, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: absoluteUrl(product.url),
      item: productSchema(product),
    })),
  };
}

export function eventSchema(event: EventItem) {
  const url = absoluteUrl(event.detailHref);
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
    image: absoluteUrl(event.image),
    startDate: event.startDateTime,
    endDate: event.endDateTime || undefined,
    eventStatus:
      event.lifecycle === "past"
        ? "https://schema.org/EventCompleted"
        : "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    organizer: { "@id": `${SITE_URL}/#organization` },
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

export function eventItemListSchema(events: EventItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "U COUNT events",
    itemListElement: events.map((event, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: absoluteUrl(event.detailHref),
      item: eventSchema(event),
    })),
  };
}
