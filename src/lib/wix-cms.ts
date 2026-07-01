import { ApiKeyStrategy, createClient } from "@wix/sdk";
import * as items from "@wix/wix-data-items-sdk";
import {
  siteCacheErrorTtlMs,
  siteCacheStaleTtlMs,
  siteCacheTtlMs,
} from "./cache";
import { resolveWixImageUrl } from "./images";
import { getEnv } from "./runtime-env";

type CmsRecord = Record<string, unknown>;

export type PageContent = {
  pageKey?: string | null;
  sectionKey?: string | null;
  isPublished?: boolean | null;
  eyebrow?: string | null;
  title?: string | null;
  subtitle?: string | null;
  body?: string | null;
  primaryCtaLabel?: string | null;
  primaryCtaUrl?: string | null;
  secondaryCtaLabel?: string | null;
  secondaryCtaUrl?: string | null;
  videoUrl?: string | null;
  image?: string | null;
  mobileImage?: string | null;
  backgroundImage?: string | null;
};

export type SiteSettings = {
  siteName?: string | null;
  tagline?: string | null;
  primaryDonateUrl?: string | null;
  mainEmail?: string | null;
  phone?: string | null;
  streetAddress?: string | null;
  cityStateZip?: string | null;
  ein?: string | null;
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  logoDark?: string | null;
  logoLight?: string | null;
  organizationSummary?: string | null;
};

export type ImpactStat = {
  label?: string | null;
  value?: string | number | null;
  suffix?: string | null;
  description?: string | null;
  theme?: string | null;
};

export type ImpactAllocation = {
  label?: string | null;
  percentage?: string | number | null;
  description?: string | null;
  colorToken?: string | null;
};

export type Initiative = {
  slug?: string | null;
  title?: string | null;
  shortDescription?: string | null;
  longDescription?: string | null;
  iconName?: string | null;
  accentToken?: string | null;
};

export type Partner = {
  slug?: string | null;
  name?: string | null;
  logo?: string | null;
  tagline?: string | null;
  description?: string | null;
  websiteUrl?: string | null;
  region?: string | null;
};

export type TeamMember = {
  slug?: string | null;
  name?: string | null;
  role?: string | null;
  headshot?: string | null;
  shortBio?: string | null;
  longBio?: string | null;
  linkLabel?: string | null;
  linkUrl?: string | null;
};

export type ValueItem = {
  title?: string | null;
  description?: string | null;
  iconName?: string | null;
};

export type ResolvedSiteSettings = {
  siteName: string;
  tagline: string;
  primaryDonateUrl: string;
  mainEmail: string;
  streetAddress: string;
  cityStateZip: string;
  ein: string;
  facebookUrl: string;
  instagramUrl: string;
  organizationSummary: string;
};

export const defaultSiteSettings: ResolvedSiteSettings = {
  siteName: "U COUNT",
  tagline: "Hope, courage, and justice since 2007",
  primaryDonateUrl:
    "https://www.paypal.com/donate/?hosted_button_id=47BPT2WKXDFCN",
  mainEmail: "info@ucountcampaign.org",
  streetAddress: "2908 S. Timberline Road",
  cityStateZip: "Fort Collins, CO 80525",
  ein: "84-0470239",
  facebookUrl: "https://www.facebook.com/UCOUNTCampaign",
  instagramUrl: "https://www.instagram.com/ucountnoco/",
  organizationSummary:
    "With hope, courage, compassion, and vision, we fight trafficking through prevention, awareness, and restoration so every person is met with dignity and justice.",
};

export function resolveSiteSettings(
  settings: SiteSettings | null | undefined,
): ResolvedSiteSettings {
  return {
    siteName: cmsText(settings?.siteName, defaultSiteSettings.siteName),
    tagline: cmsText(settings?.tagline, defaultSiteSettings.tagline),
    primaryDonateUrl: cmsText(
      settings?.primaryDonateUrl,
      defaultSiteSettings.primaryDonateUrl,
    ),
    mainEmail: cmsText(settings?.mainEmail, defaultSiteSettings.mainEmail),
    streetAddress: cmsText(
      settings?.streetAddress,
      defaultSiteSettings.streetAddress,
    ),
    cityStateZip: cmsText(
      settings?.cityStateZip,
      defaultSiteSettings.cityStateZip,
    ),
    ein: cmsText(settings?.ein, defaultSiteSettings.ein),
    facebookUrl: cmsText(settings?.facebookUrl, defaultSiteSettings.facebookUrl),
    instagramUrl: cmsText(
      settings?.instagramUrl,
      defaultSiteSettings.instagramUrl,
    ),
    organizationSummary: cmsText(
      settings?.organizationSummary,
      defaultSiteSettings.organizationSummary,
    ),
  };
}

type WixQuery = {
  eq: (field: string, value: unknown) => WixQuery;
  ascending: (field: string) => WixQuery;
  limit: (limit: number) => WixQuery;
  find: (options: { consistentRead: boolean }) => Promise<{ items: unknown[] }>;
};

type CmsCacheEntry<T> = {
  expiresAt: number;
  staleUntil: number;
  value: Promise<T>;
  resolvedValue?: T;
};

const cmsCache = new Map<string, CmsCacheEntry<unknown>>();

function getCollectionAliases(): Record<string, string> {
  const rawAliases = getEnv("WIX_CMS_COLLECTION_ALIASES");

  if (!rawAliases) {
    return {};
  }

  try {
    const aliases = JSON.parse(rawAliases) as Record<string, unknown>;

    return Object.fromEntries(
      Object.entries(aliases).filter(
        (entry): entry is [string, string] =>
          typeof entry[0] === "string" && typeof entry[1] === "string",
      ),
    );
  } catch (error) {
    console.error("Failed to parse WIX_CMS_COLLECTION_ALIASES", error);
    return {};
  }
}

const collectionAliases = getCollectionAliases();

function resolveCollectionId(collectionId: string): string {
  return collectionAliases[collectionId] ?? collectionId;
}

function createWixDataClient() {
  const apiKey = getEnv("WIX_DATA_API_KEY");
  const siteId = getEnv("WIX_SITE_ID");

  if (!apiKey || !siteId) {
    return null;
  }

  return createClient({
    modules: { items },
    auth: ApiKeyStrategy({ apiKey, siteId }),
  });
}

let wixDataClient: ReturnType<typeof createWixDataClient> | undefined;
let missingDataCredentialsWarningShown = false;

function getWixDataClient() {
  wixDataClient ??= createWixDataClient();

  if (!wixDataClient && !missingDataCredentialsWarningShown) {
    missingDataCredentialsWarningShown = true;
    console.warn(
      "WIX_DATA_API_KEY or WIX_SITE_ID is not set; CMS content will use local fallbacks.",
    );
  }

  return wixDataClient;
}

async function queryCollection<T extends CmsRecord>(
  collectionId: string,
  cacheKey: string,
  buildQuery?: (query: WixQuery) => WixQuery,
): Promise<T[]> {
  const client = getWixDataClient();

  if (!client) {
    return [];
  }

  const resolvedCollectionId = resolveCollectionId(collectionId);

  return getCachedCmsValue(
    `${resolvedCollectionId}:${cacheKey}`,
    async () => {
      const baseQuery = client.items.query(resolvedCollectionId);
      const query = buildQuery ? buildQuery(baseQuery) : baseQuery;
      const result = await query.find({ consistentRead: true });

      return result.items as T[];
    },
    (error) => {
      console.error(`Failed to load CMS collection ${collectionId}`, error);
    },
  );
}

function getCachedCmsValue<T>(
  key: string,
  load: () => Promise<T>,
  onError: (error: unknown) => void,
): Promise<T> {
  const now = Date.now();
  const cachedValue = cmsCache.get(key) as CmsCacheEntry<T> | undefined;

  if (cachedValue && cachedValue.expiresAt > now) {
    return cachedValue.value;
  }

  const previousValue = cachedValue;
  let nextEntry: CmsCacheEntry<T>;
  const value = Promise.resolve()
    .then(load)
    .then((result) => {
      nextEntry.resolvedValue = result;

      return result;
    })
    .catch((error) => {
      onError(error);

      const retryAt = Date.now() + siteCacheErrorTtlMs;

      if (
        previousValue?.resolvedValue !== undefined &&
        previousValue.staleUntil > Date.now()
      ) {
        nextEntry.resolvedValue = previousValue.resolvedValue;
        nextEntry.value = Promise.resolve(previousValue.resolvedValue);
        nextEntry.expiresAt = retryAt;
        nextEntry.staleUntil = previousValue.staleUntil;

        return previousValue.resolvedValue;
      }

      const fallback = [] as T;
      nextEntry.resolvedValue = fallback;
      nextEntry.value = Promise.resolve(fallback);
      nextEntry.expiresAt = retryAt;
      nextEntry.staleUntil = retryAt;

      return fallback;
    });

  nextEntry = {
    expiresAt: now + siteCacheTtlMs,
    staleUntil: now + siteCacheStaleTtlMs,
    value,
  };
  cmsCache.set(key, nextEntry);

  return value;
}

function getPageSections(pageKey: string): Promise<(PageContent & CmsRecord)[]> {
  return queryCollection<PageContent & CmsRecord>(
    "PageContent",
    `page:${pageKey}`,
    (query) => query.eq("pageKey", pageKey).eq("isPublished", true).limit(100),
  );
}

function bySortOrder<T extends CmsRecord>(left: T, right: T): number {
  const leftOrder = typeof left.sortOrder === "number" ? left.sortOrder : 0;
  const rightOrder = typeof right.sortOrder === "number" ? right.sortOrder : 0;

  return leftOrder - rightOrder;
}

async function querySortedCollection<T extends CmsRecord>(
  collectionId: string,
  cacheKey: string,
  buildQuery: (query: WixQuery) => WixQuery,
): Promise<T[]> {
  const rows = await queryCollection<T>(collectionId, cacheKey, buildQuery);

  if (rows.length <= 1) {
    return rows;
  }

  return [...rows].sort(bySortOrder);
}

export async function getPageSection(
  pageKey: string,
  sectionKey: string,
): Promise<PageContent | null> {
  const sections = await getPageSections(pageKey);

  return sections.find((section) => section.sectionKey === sectionKey) ?? null;
}

export async function getSiteSettings(): Promise<SiteSettings | null> {
  const settings = await queryCollection<SiteSettings & CmsRecord>(
    "SiteSettings",
    "singleton",
    (query) => query.limit(1),
  );

  return settings[0] ?? null;
}

export function getImpactStats(groupKey: string): Promise<ImpactStat[]> {
  return querySortedCollection<ImpactStat & CmsRecord>(
    "ImpactStats",
    `group:${groupKey}`,
    (query) =>
      query.eq("groupKey", groupKey).eq("isActive", true).ascending("sortOrder"),
  );
}

export function getImpactAllocations(
  groupKey: string,
): Promise<ImpactAllocation[]> {
  return querySortedCollection<ImpactAllocation & CmsRecord>(
    "ImpactAllocations",
    `group:${groupKey}`,
    (query) => query.eq("groupKey", groupKey).ascending("sortOrder"),
  );
}

export function getInitiatives(pageKey: string): Promise<Initiative[]> {
  return querySortedCollection<Initiative & CmsRecord>(
    "Initiatives",
    `page:${pageKey}`,
    (query) => query.eq("pageKey", pageKey).ascending("sortOrder"),
  );
}

export function getPartners(): Promise<Partner[]> {
  return querySortedCollection<Partner & CmsRecord>(
    "Partners",
    "active",
    (query) => query.eq("isActive", true).ascending("sortOrder"),
  );
}

export function getTeamMembers(): Promise<TeamMember[]> {
  return querySortedCollection<TeamMember & CmsRecord>(
    "TeamMembers",
    "active",
    (query) => query.eq("isActive", true).ascending("sortOrder"),
  );
}

export function getValues(): Promise<ValueItem[]> {
  return querySortedCollection<ValueItem & CmsRecord>(
    "Values",
    "active",
    (query) => query.eq("isActive", true).ascending("sortOrder"),
  );
}

export function cmsText(
  value: string | null | undefined,
  fallback: string,
): string {
  return value?.trim() || fallback;
}

export function cmsValue(
  value: string | number | null | undefined,
  fallback: string,
): string {
  if (typeof value === "number") {
    return Number.isInteger(value) ? value.toString() : value.toFixed(1);
  }

  return value?.trim() || fallback;
}

export function cmsImageUrl(value: unknown, fallback: string): string {
  return resolveWixImageUrl(value, fallback);
}
