import { resizeWixImageUrl } from "./images";
import { siteCacheTtlMs } from "./cache";

export type EventLifecycle = "upcoming" | "past";

export type EventAccent = "ember" | "gold" | "sky";
export type EventImageLayout = "cover" | "contain";

export type EventItem = {
  id: string;
  slug: string;
  title: string;
  eyebrow: string;
  summary: string;
  description: string;
  startDateTime: string;
  endDateTime: string;
  dateLabel: string;
  timeLabel: string;
  venueName: string;
  addressLines: string[];
  locationLabel: string;
  locationIsTbd: boolean;
  badge: string;
  status: string;
  lifecycle: EventLifecycle;
  accent: EventAccent;
  image: string;
  imageAlt: string;
  imageLayout: EventImageLayout;
  detailHref: string;
  originalUrl: string;
  registrationHref: string;
  registrationLabel: string;
  registrationAvailable: boolean;
  calendarHref: string;
};

export type EventsResult = {
  upcomingEvents: EventItem[];
  pastEvents: EventItem[];
  allEvents: EventItem[];
  source: "wix" | "unavailable";
};

type WixEventsResponse = {
  events?: WixEvent[];
  message?: string;
  details?: {
    applicationError?: {
      description?: string;
    };
  };
};

type WixEvent = {
  id?: string;
  title?: string | null;
  slug?: string | null;
  status?: string | null;
  description?: unknown;
  shortDescription?: string | null;
  detailedDescription?: unknown;
  eventPageUrl?: {
    base?: string | null;
    path?: string | null;
  } | null;
  calendarUrls?: {
    google?: string | null;
    ics?: string | null;
  } | null;
  dateAndTimeSettings?: {
    dateAndTimeTbd?: boolean | null;
    startDate?: string | null;
    endDate?: string | null;
    timeZoneId?: string | null;
    hideEndDate?: boolean | null;
    formatted?: {
      dateAndTime?: string | null;
      startDate?: string | null;
      startTime?: string | null;
      endDate?: string | null;
      endTime?: string | null;
    } | null;
  } | null;
  location?: {
    name?: string | null;
    type?: string | null;
    locationTbd?: boolean | null;
    address?: {
      city?: string | null;
      subdivision?: string | null;
      postalCode?: string | null;
      formattedAddress?: string | null;
    } | null;
  } | null;
  registration?: {
    initialType?: string | null;
    type?: string | null;
    status?: string | null;
    registrationDisabled?: boolean | null;
    registrationPaused?: boolean | null;
    external?: {
      url?: string | null;
    } | null;
  } | null;
};

const marketplaceBoutiqueImageId = "dc65de_cbfbc80860444ed4bd8c9cec3ab039ef~mv2.jpg";
const marketplaceBoutiqueImage = "/assets/events/ucount-marketplace-boutique-borderless.webp";
const eventPlaceholderImage = "/assets/events/ucount-event-placeholder.webp";

type EventCacheEntry<T> = {
  expiresAt: number;
  value: Promise<T>;
};

const eventCache = new Map<string, EventCacheEntry<unknown>>();
let missingEventsCredentialsWarningShown = false;

function getCachedEventValue<T>(key: string, load: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const cachedValue = eventCache.get(key) as EventCacheEntry<T> | undefined;

  if (cachedValue && cachedValue.expiresAt > now) {
    return cachedValue.value;
  }

  const value = load().catch((error) => {
    if (eventCache.get(key)?.value === value) {
      eventCache.delete(key);
    }

    throw error;
  });

  eventCache.set(key, {
    expiresAt: now + siteCacheTtlMs,
    value,
  });

  return value;
}

function getEventsApiConfig() {
  const apiKey =
    import.meta.env.WIX_EVENTS_API_KEY?.trim() ||
    import.meta.env.WIX_DATA_API_KEY?.trim();
  const siteId = import.meta.env.WIX_SITE_ID?.trim();

  if (!apiKey || !siteId) {
    if (!missingEventsCredentialsWarningShown) {
      missingEventsCredentialsWarningShown = true;
      console.warn(
        "WIX_EVENTS_API_KEY or WIX_DATA_API_KEY plus WIX_SITE_ID is not set; events will be unavailable.",
      );
    }

    return null;
  }

  return { apiKey, siteId };
}

async function wixEventsRequest(body: unknown): Promise<WixEvent[]> {
  const config = getEventsApiConfig();

  if (!config) {
    return [];
  }

  const response = await fetch("https://www.wixapis.com/events/v3/events/query", {
    method: "POST",
    headers: {
      Authorization: config.apiKey,
      "Content-Type": "application/json",
      "wix-site-id": config.siteId,
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  const data = text ? (JSON.parse(text) as WixEventsResponse) : {};

  if (!response.ok) {
    throw new Error(
      data.message ||
        data.details?.applicationError?.description ||
        `Wix Events request failed with ${response.status} ${response.statusText}`,
    );
  }

  return data.events ?? [];
}

function decodeHtmlEntity(entity: string): string {
  const htmlEntities: Record<string, string> = {
    amp: "&",
    apos: "'",
    bull: "-",
    gt: ">",
    hellip: "...",
    ldquo: '"',
    lsquo: "'",
    lt: "<",
    mdash: "-",
    nbsp: " ",
    ndash: "-",
    quot: '"',
    rdquo: '"',
    rsquo: "'",
  };

  if (entity.startsWith("#x")) {
    const codePoint = Number.parseInt(entity.slice(2), 16);
    return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : "";
  }

  if (entity.startsWith("#")) {
    const codePoint = Number.parseInt(entity.slice(1), 10);
    return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : "";
  }

  return htmlEntities[entity] ?? "";
}

function htmlToText(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (_match, entity: string) =>
      decodeHtmlEntity(entity.toLowerCase()),
    )
    .replace(/\s+/g, " ")
    .trim();
}

function textFromUnknown(value: unknown): string {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return htmlToText(value);
  }

  if (Array.isArray(value)) {
    return value.map(textFromUnknown).filter(Boolean).join(" ").trim();
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const directText = typeof record.text === "string" ? record.text : "";
    const textData =
      record.textData && typeof record.textData === "object"
        ? (record.textData as Record<string, unknown>)
        : null;
    const richText = typeof textData?.text === "string" ? textData.text : "";
    const childText = ["nodes", "children"]
      .map((key) => textFromUnknown(record[key]))
      .filter(Boolean)
      .join(" ");

    return [directText, richText, childText].filter(Boolean).join(" ").trim();
  }

  return "";
}

function firstWixImageUrl(value: unknown): string {
  if (!value || typeof value !== "object") {
    return "";
  }

  if (Array.isArray(value)) {
    return value.map(firstWixImageUrl).find(Boolean) ?? "";
  }

  const record = value as Record<string, unknown>;
  const imageData =
    record.imageData && typeof record.imageData === "object"
      ? (record.imageData as Record<string, unknown>)
      : null;
  const image =
    imageData?.image && typeof imageData.image === "object"
      ? (imageData.image as Record<string, unknown>)
      : null;
  const src =
    image?.src && typeof image.src === "object"
      ? (image.src as Record<string, unknown>)
      : null;
  const id = typeof src?.id === "string" ? src.id.trim() : "";

  if (id && /^[A-Za-z0-9_.~-]+$/.test(id)) {
    return `https://static.wixstatic.com/media/${id}`;
  }

  return ["nodes", "children"]
    .map((key) => firstWixImageUrl(record[key]))
    .find(Boolean) ?? "";
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  const clipped = value.slice(0, maxLength).trim();
  const trimmedAtWord = clipped.replace(/\s+\S*$/, "").trim();

  return `${trimmedAtWord || clipped}...`;
}

function eventOriginalUrl(event: WixEvent): string {
  const base = event.eventPageUrl?.base?.trim();
  const path = event.eventPageUrl?.path?.trim();

  if (!base || !path) {
    return "";
  }

  try {
    return new URL(path, base).toString();
  } catch {
    return "";
  }
}

function formatDateLabel(event: WixEvent): string {
  const formatted = event.dateAndTimeSettings?.formatted;

  if (formatted?.startDate) {
    return formatted.startDate;
  }

  const startDate = event.dateAndTimeSettings?.startDate;

  if (!startDate) {
    return "Date TBD";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "full",
    timeZone: event.dateAndTimeSettings?.timeZoneId ?? "America/Denver",
  }).format(new Date(startDate));
}

function formatTimeLabel(event: WixEvent): string {
  const settings = event.dateAndTimeSettings;
  const formatted = settings?.formatted;

  if (settings?.dateAndTimeTbd) {
    return "Time TBD";
  }

  if (formatted?.startTime && formatted.endTime && !settings?.hideEndDate) {
    return `${formatted.startTime} - ${formatted.endTime}`;
  }

  if (formatted?.startTime) {
    return formatted.startTime;
  }

  return "";
}

function addressLines(event: WixEvent): string[] {
  if (event.location?.locationTbd) {
    return ["Location is TBD"];
  }

  const formattedAddress = event.location?.address?.formattedAddress
    ?.replace(/,\s*USA$/i, "")
    .trim();

  if (formattedAddress) {
    return [formattedAddress];
  }

  return [];
}

function locationLabel(event: WixEvent): string {
  if (event.location?.locationTbd) {
    return "Location is TBD";
  }

  const city = event.location?.address?.city?.trim();
  const subdivision = event.location?.address?.subdivision?.trim();

  return [city, subdivision].filter(Boolean).join(", ") || "In person";
}

function eventAccent(event: WixEvent): EventAccent {
  const title = event.title?.toLowerCase() ?? "";

  if (/market|boutique|shop/.test(title)) {
    return "ember";
  }

  if (/symposium|awareness|learn|speaker/.test(title)) {
    return "sky";
  }

  return "gold";
}

function eventEyebrow(event: WixEvent): string {
  const title = event.title?.toLowerCase() ?? "";

  if (/market|boutique|shop/.test(title)) {
    return "Marketplace";
  }

  if (/symposium|awareness/.test(title)) {
    return "Awareness";
  }

  return "Community";
}

function eventImage(
  event: WixEvent,
  wixImageUrl: string,
): Pick<EventItem, "image" | "imageAlt" | "imageLayout"> {
  if (wixImageUrl.includes(marketplaceBoutiqueImageId)) {
    return {
      image: marketplaceBoutiqueImage,
      imageAlt: event.title?.trim() || "U COUNT Marketplace Boutique event image.",
      imageLayout: "cover",
    };
  }

  if (wixImageUrl) {
    return {
      image: resizeWixImageUrl(wixImageUrl, {
        width: 1200,
        height: 675,
        mode: "fill",
      }),
      imageAlt: event.title?.trim() || "U COUNT event image.",
      imageLayout: "cover",
    };
  }

  return {
    image: eventPlaceholderImage,
    imageAlt: "U COUNT event placeholder image.",
    imageLayout: "cover",
  };
}

function eventLifecycle(event: WixEvent): EventLifecycle {
  const status = event.status?.toUpperCase();

  if (status === "ENDED" || status === "CANCELED") {
    return "past";
  }

  const endDate = event.dateAndTimeSettings?.endDate;

  return endDate && new Date(endDate).getTime() < Date.now()
    ? "past"
    : "upcoming";
}

function eventBadge(event: WixEvent): string {
  const status = event.status?.toUpperCase();

  if (status === "STARTED") {
    return "Happening now";
  }

  if (status === "ENDED") {
    return "Past";
  }

  if (event.registration?.registrationPaused) {
    return "Registration paused";
  }

  if (event.registration?.status === "OPEN") {
    return "Registration open";
  }

  return "Upcoming";
}

function registrationAvailable(event: WixEvent): boolean {
  const registration = event.registration;
  const status = registration?.status?.toUpperCase();

  return Boolean(
    registration &&
      !registration.registrationDisabled &&
      !registration.registrationPaused &&
      status &&
      !["CLOSED", "CLOSED_AUTOMATICALLY", "UNKNOWN_REGISTRATION_STATUS"].includes(
        status,
      ),
  );
}

function registrationHref(event: WixEvent): string {
  return event.registration?.external?.url?.trim() || eventOriginalUrl(event);
}

function registrationLabel(event: WixEvent): string {
  const type = event.registration?.initialType?.toUpperCase();

  if (type === "TICKETING") {
    return "Get Tickets";
  }

  return "Register";
}

function normalizeEvent(event: WixEvent): EventItem | null {
  const id = event.id?.trim();
  const slug = event.slug?.trim();
  const title = event.title?.trim();

  if (!id || !slug || !title) {
    return null;
  }

  const shortDescription = htmlToText(event.shortDescription);
  const richDescription = textFromUnknown(event.description);
  const fullDescription =
    textFromUnknown(event.detailedDescription) || richDescription;
  const summary =
    shortDescription ||
    truncateText(fullDescription, 170) ||
    "Event details will be available soon.";
  const description = fullDescription || shortDescription;
  const originalUrl = eventOriginalUrl(event);
  const image = eventImage(event, firstWixImageUrl(event.description));
  const available = registrationAvailable(event);

  return {
    id,
    slug,
    title,
    eyebrow: eventEyebrow(event),
    summary,
    description,
    startDateTime: event.dateAndTimeSettings?.startDate ?? "",
    endDateTime:
      event.dateAndTimeSettings?.endDate ??
      event.dateAndTimeSettings?.startDate ??
      "",
    dateLabel: formatDateLabel(event),
    timeLabel: formatTimeLabel(event),
    venueName:
      event.location?.name?.trim() ||
      (event.location?.locationTbd ? "Location is TBD" : "Event location"),
    addressLines: addressLines(event),
    locationLabel: locationLabel(event),
    locationIsTbd: Boolean(event.location?.locationTbd),
    badge: eventBadge(event),
    status: event.status ?? "",
    lifecycle: eventLifecycle(event),
    accent: eventAccent(event),
    image: image.image,
    imageAlt: image.imageAlt,
    imageLayout: image.imageLayout,
    detailHref: `/event-details/${slug}`,
    originalUrl,
    registrationHref: available ? registrationHref(event) : "",
    registrationLabel: registrationLabel(event),
    registrationAvailable: available,
    calendarHref: event.calendarUrls?.google?.trim() || "",
  };
}

function eventSortAscending(left: EventItem, right: EventItem): number {
  return new Date(left.startDateTime).getTime() - new Date(right.startDateTime).getTime();
}

function eventSortDescending(left: EventItem, right: EventItem): number {
  return eventSortAscending(right, left);
}

async function queryUpcomingEvents(): Promise<WixEvent[]> {
  return wixEventsRequest({
    fields: ["DETAILS", "URLS", "TEXTS", "REGISTRATION"],
    query: {
      filter: { status: { $in: ["UPCOMING", "STARTED"] } },
      sort: [{ fieldName: "dateAndTimeSettings.startDate", order: "ASC" }],
      paging: { limit: 50, offset: 0 },
    },
  });
}

async function queryPastEvents(): Promise<WixEvent[]> {
  return wixEventsRequest({
    fields: ["DETAILS", "URLS", "TEXTS", "REGISTRATION"],
    query: {
      filter: { status: { $in: ["ENDED"] } },
      sort: [{ fieldName: "dateAndTimeSettings.startDate", order: "DESC" }],
      paging: { limit: 50, offset: 0 },
    },
  });
}

export async function getEvents(): Promise<EventsResult> {
  try {
    return await getCachedEventValue("events:index", async () => {
      const [upcomingRows, pastRows] = await Promise.all([
        queryUpcomingEvents(),
        queryPastEvents(),
      ]);
      const upcomingEvents = upcomingRows
        .map(normalizeEvent)
        .filter((event): event is EventItem => Boolean(event))
        .sort(eventSortAscending);
      const pastEvents = pastRows
        .map(normalizeEvent)
        .filter((event): event is EventItem => Boolean(event))
        .sort(eventSortDescending);

      return {
        upcomingEvents,
        pastEvents,
        allEvents: [...upcomingEvents, ...pastEvents],
        source: "wix",
      };
    });
  } catch (error) {
    console.error("Failed to load Wix Events", error);

    return {
      upcomingEvents: [],
      pastEvents: [],
      allEvents: [],
      source: "unavailable",
    };
  }
}

export async function getEventBySlug(
  slug: string | undefined,
): Promise<EventItem | null> {
  const cleanSlug = slug?.trim();

  if (!cleanSlug) {
    return null;
  }

  try {
    return await getCachedEventValue(`events:slug:${cleanSlug}`, async () => {
      const rows = await wixEventsRequest({
        fields: ["DETAILS", "URLS", "TEXTS", "REGISTRATION"],
        query: {
          filter: { slug: { $eq: cleanSlug } },
          paging: { limit: 1, offset: 0 },
        },
      });

      return normalizeEvent(rows[0]) ?? null;
    });
  } catch (error) {
    console.error(`Failed to load Wix Event ${cleanSlug}`, error);
    return null;
  }
}
