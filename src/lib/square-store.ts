import { siteCacheTtlMs } from "./cache";
import { getEnv } from "./runtime-env";

/**
 * Square-backed storefront. Products, categories, and stock come from the
 * Square Catalog + Inventory APIs; checkout creates a Square-hosted Payment
 * Link. The exported types and functions intentionally match the old Wix
 * store module so page templates only changed import paths.
 *
 * All reads derive from one cached catalog snapshot (see `loadCatalog`), so a
 * cold page load costs one paginated catalog search plus one inventory batch.
 */

const SQUARE_API_VERSION = "2026-07-15";

const SQUARE_BASE_URLS = {
  production: "https://connect.squareup.com",
  sandbox: "https://connect.squareupsandbox.com",
} as const;

type SquareMoney = {
  amount?: number;
  currency?: string;
};

type SquareItemOptionValue = {
  item_option_id?: string;
  name?: string | null;
  description?: string | null;
  color?: string | null;
};

type SquareItemOptionData = {
  name?: string | null;
  display_name?: string | null;
  values?: SquareCatalogObject[];
};

type SquareLocationOverride = {
  location_id?: string;
  price_money?: SquareMoney;
  track_inventory?: boolean;
  sold_out?: boolean;
};

type SquareItemVariationData = {
  item_id?: string;
  name?: string | null;
  sku?: string | null;
  ordinal?: number;
  pricing_type?: string;
  price_money?: SquareMoney;
  item_option_values?: Array<{
    item_option_id?: string;
    item_option_value_id?: string;
  }>;
  track_inventory?: boolean;
  sellable?: boolean;
  stockable?: boolean;
  image_ids?: string[];
  location_overrides?: SquareLocationOverride[];
};

type SquareItemData = {
  name?: string | null;
  description?: string | null;
  description_html?: string | null;
  description_plaintext?: string | null;
  is_archived?: boolean;
  image_ids?: string[];
  categories?: Array<{ id?: string }>;
  item_options?: Array<{ item_option_id?: string }>;
  variations?: SquareCatalogObject[];
  ecom_uri?: string | null;
};

type SquareCatalogObject = {
  type?: string;
  id?: string;
  updated_at?: string;
  is_deleted?: boolean;
  present_at_all_locations?: boolean;
  present_at_location_ids?: string[];
  absent_at_location_ids?: string[];
  item_data?: SquareItemData;
  item_variation_data?: SquareItemVariationData;
  category_data?: { name?: string | null };
  image_data?: { name?: string | null; url?: string | null; caption?: string | null };
  item_option_data?: SquareItemOptionData;
  item_option_value_data?: SquareItemOptionValue;
};

type SquareError = {
  category?: string;
  code?: string;
  detail?: string;
};

export type StoreProductCard = {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: string;
  priceValue: number | null;
  image: string;
  imageSrcSet: string;
  imageAlt: string;
  url: string;
  inStock: boolean;
  collectionIds: string[];
  categoryNames: string[];
  ribbon: string;
  createdDate: string;
};

export type StorefrontProducts = {
  products: StoreProductCard[];
  allProductsUrl: string;
  collections?: StoreCollection[];
};

export type StoreCollection = {
  id: string;
  name: string;
  slug: string;
  productCount: number;
};

export type StoreProductImage = {
  id: string;
  url: string;
  thumbnailUrl: string;
  fullUrl: string;
  srcSet: string;
  alt: string;
};

export type StoreProductOptionChoice = {
  label: string;
  swatch: string;
  inStock: boolean;
  visible: boolean;
  image?: StoreProductImage;
};

export type StoreProductOption = {
  name: string;
  type: string;
  choices: StoreProductOptionChoice[];
};

export type StoreProductVariant = {
  id: string;
  label: string;
  choices: Record<string, string>;
  price: string;
  sku: string;
  inStock: boolean;
  visible: boolean;
  quantity: number | null;
  image?: StoreProductImage;
};

export type StoreProductDetail = StoreProductCard & {
  originalUrl: string;
  fullDescription: string;
  images: StoreProductImage[];
  options: StoreProductOption[];
  variants: StoreProductVariant[];
  manageVariants: boolean;
  stockQuantity: number | null;
  inventoryStatus: string;
  additionalInfoSections: Array<{
    title: string;
    body: string;
  }>;
};

const defaultAllProductsUrl = "/shop";

type StoreCacheEntry<T> = {
  expiresAt: number;
  value: Promise<T>;
};

const storeCache = new Map<string, StoreCacheEntry<unknown>>();

const htmlEntities: Record<string, string> = {
  amp: "&",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: '"',
  apos: "'",
  bull: "-",
  hellip: "...",
  ldquo: '"',
  lsquo: "'",
  mdash: "-",
  ndash: "-",
  rdquo: '"',
  rsquo: "'",
};

function getCachedStoreValue<T>(key: string, load: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const cachedValue = storeCache.get(key) as StoreCacheEntry<T> | undefined;

  if (cachedValue && cachedValue.expiresAt > now) {
    return cachedValue.value;
  }

  const value = load().catch((error) => {
    if (storeCache.get(key)?.value === value) {
      storeCache.delete(key);
    }

    throw error;
  });

  storeCache.set(key, {
    expiresAt: now + siteCacheTtlMs,
    value,
  });

  return value;
}

type SquareConfig = {
  accessToken: string;
  locationId: string;
  baseUrl: string;
};

let missingSquareCredentialsWarningShown = false;

function getSquareConfig(): SquareConfig | null {
  const accessToken = getEnv("SQUARE_ACCESS_TOKEN");
  const locationId = getEnv("SQUARE_LOCATION_ID");

  if (!accessToken || !locationId) {
    if (!missingSquareCredentialsWarningShown) {
      missingSquareCredentialsWarningShown = true;
      console.warn(
        "SQUARE_ACCESS_TOKEN or SQUARE_LOCATION_ID is not set; store products will be unavailable.",
      );
    }

    return null;
  }

  const environment =
    getEnv("SQUARE_ENVIRONMENT") === "sandbox" ? "sandbox" : "production";

  return { accessToken, locationId, baseUrl: SQUARE_BASE_URLS[environment] };
}

async function squareApiRequest<T>(
  config: SquareConfig,
  path: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch(`${config.baseUrl}${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Square-Version": SQUARE_API_VERSION,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  const data = text
    ? (JSON.parse(text) as T & { errors?: SquareError[] })
    : ({} as T & { errors?: SquareError[] });

  if (!response.ok) {
    const detail = data.errors?.[0]?.detail ?? data.errors?.[0]?.code;

    throw new Error(
      detail ||
        `Square API request failed with ${response.status} ${response.statusText}`,
    );
  }

  return data;
}

function decodeHtmlEntity(entity: string): string {
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

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  const clipped = value.slice(0, maxLength).trim();
  const trimmedAtWord = clipped.replace(/\s+\S*$/, "").trim();

  return `${trimmedAtWord || clipped}...`;
}

function formatMoney(money: SquareMoney | undefined): string {
  if (typeof money?.amount !== "number") {
    return "";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: money.currency ?? "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(money.amount / 100);
}

function moneyValue(money: SquareMoney | undefined): number | null {
  return typeof money?.amount === "number" ? money.amount / 100 : null;
}

/** Variation price at the configured location; overrides win over the base. */
function getVariationPriceMoney(
  variation: SquareCatalogObject | undefined,
  locationId: string,
): SquareMoney | undefined {
  const override = variation?.item_variation_data?.location_overrides?.find(
    (entry) => entry.location_id === locationId,
  );

  return override?.price_money ?? variation?.item_variation_data?.price_money;
}

/** URL slug derived from the product name; Square has no native slug field. */
function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Whether a catalog object is sold/visible at the configured location. */
function isPresentAtLocation(
  object: SquareCatalogObject,
  locationId: string,
): boolean {
  if (object.absent_at_location_ids?.includes(locationId)) {
    return false;
  }

  if (object.present_at_all_locations === false) {
    return object.present_at_location_ids?.includes(locationId) ?? false;
  }

  return true;
}

type CatalogContext = {
  locationId: string;
  relatedById: Map<string, SquareCatalogObject>;
  inventoryByVariationId: Map<string, number>;
};

function mapImage(
  imageId: string | undefined,
  context: CatalogContext,
  alt: string,
): StoreProductImage | null {
  const object = imageId ? context.relatedById.get(imageId) : undefined;
  const url = object?.image_data?.url?.trim();

  if (!object?.id || !url) {
    return null;
  }

  // Square-hosted images have no resize parameters, so every size points at
  // the original upload and srcSet stays empty (browsers fall back to src).
  return {
    id: object.id,
    url,
    thumbnailUrl: url,
    fullUrl: url,
    srcSet: "",
    alt: object.image_data?.caption?.trim() || alt,
  };
}

function getProductImages(
  item: SquareCatalogObject,
  context: CatalogContext,
  name: string,
): StoreProductImage[] {
  const images: StoreProductImage[] = [];

  for (const imageId of item.item_data?.image_ids ?? []) {
    const image = mapImage(imageId, context, name);

    if (image && !images.some((existing) => existing.url === image.url)) {
      images.push(image);
    }
  }

  return images;
}

type VariationStock = {
  inStock: boolean;
  quantity: number | null;
};

/**
 * Stock for one variation at the configured location: an explicit sold-out
 * override wins, then live inventory counts when tracking is enabled, and
 * untracked variations are always purchasable.
 */
function getVariationStock(
  variation: SquareCatalogObject,
  context: CatalogContext,
): VariationStock {
  const data = variation.item_variation_data;
  const override = data?.location_overrides?.find(
    (entry) => entry.location_id === context.locationId,
  );

  if (override?.sold_out) {
    return { inStock: false, quantity: 0 };
  }

  const trackInventory = override?.track_inventory ?? data?.track_inventory;

  if (trackInventory) {
    const quantity = variation.id
      ? (context.inventoryByVariationId.get(variation.id) ?? 0)
      : 0;

    return { inStock: quantity > 0, quantity: Math.max(0, quantity) };
  }

  return { inStock: true, quantity: null };
}

type OptionValueNames = Map<string, { optionName: string; valueName: string; color: string }>;

/** Flattens ITEM_OPTION related objects into a value-id -> names lookup. */
function buildOptionValueNames(context: CatalogContext): OptionValueNames {
  const names: OptionValueNames = new Map();

  for (const object of context.relatedById.values()) {
    if (object.type !== "ITEM_OPTION" || !object.item_option_data) {
      continue;
    }

    const optionName =
      object.item_option_data.display_name?.trim() ||
      object.item_option_data.name?.trim() ||
      "";

    for (const value of object.item_option_data.values ?? []) {
      const valueName = value.item_option_value_data?.name?.trim();

      if (object.id && value.id && optionName && valueName) {
        names.set(value.id, {
          optionName,
          valueName,
          color: value.item_option_value_data?.color?.trim() ?? "",
        });
      }
    }
  }

  return names;
}

function getVariantChoices(
  variation: SquareCatalogObject,
  optionValueNames: OptionValueNames,
): Record<string, string> {
  const choices: Record<string, string> = {};

  for (const optionValue of variation.item_variation_data?.item_option_values ?? []) {
    const names = optionValue.item_option_value_id
      ? optionValueNames.get(optionValue.item_option_value_id)
      : undefined;

    if (names) {
      choices[names.optionName] = names.valueName;
    }
  }

  return choices;
}

function getVariantLabel(
  variation: SquareCatalogObject,
  choices: Record<string, string>,
  fallback: string,
): string {
  const choiceValues = Object.values(choices).filter(Boolean);

  if (choiceValues.length) {
    return choiceValues.join(" / ");
  }

  return variation.item_variation_data?.name?.trim() || fallback;
}

function mapVariants(
  item: SquareCatalogObject,
  context: CatalogContext,
  optionValueNames: OptionValueNames,
  name: string,
  fallbackPrice: string,
): StoreProductVariant[] {
  return (item.item_data?.variations ?? [])
    .map((variation) => {
      const id = variation.id?.trim();

      if (!id || !isPresentAtLocation(variation, context.locationId)) {
        return null;
      }

      const stock = getVariationStock(variation, context);
      const choices = getVariantChoices(variation, optionValueNames);
      const data = variation.item_variation_data;
      const image = mapImage(data?.image_ids?.[0], context, name);

      return {
        id,
        label: getVariantLabel(variation, choices, name),
        choices,
        price:
          formatMoney(getVariationPriceMoney(variation, context.locationId)) ||
          fallbackPrice,
        sku: data?.sku?.trim() ?? "",
        inStock: stock.inStock,
        visible: data?.sellable !== false,
        quantity: stock.quantity,
        ...(image ? { image } : {}),
      };
    })
    .filter((variant): variant is StoreProductVariant => Boolean(variant));
}

function mapOptions(
  item: SquareCatalogObject,
  context: CatalogContext,
  variants: StoreProductVariant[],
): StoreProductOption[] {
  return (item.item_data?.item_options ?? [])
    .map((itemOption) => {
      const object = itemOption.item_option_id
        ? context.relatedById.get(itemOption.item_option_id)
        : undefined;
      const optionName =
        object?.item_option_data?.display_name?.trim() ||
        object?.item_option_data?.name?.trim();

      if (!object || !optionName) {
        return null;
      }

      return {
        name: optionName,
        type: "drop_down",
        choices: (object.item_option_data?.values ?? [])
          .map((value) => {
            const label = value.item_option_value_data?.name?.trim();

            if (!label) {
              return null;
            }

            return {
              label,
              swatch: value.item_option_value_data?.color?.trim() ?? "",
              inStock: variants.some(
                (variant) => variant.choices[optionName] === label && variant.inStock,
              ),
              visible: true,
            };
          })
          .filter((choice): choice is StoreProductOptionChoice => Boolean(choice)),
      };
    })
    .filter((option): option is StoreProductOption => Boolean(option));
}

function getCategoryEntries(
  item: SquareCatalogObject,
  context: CatalogContext,
): StoreCollection[] {
  const entries: StoreCollection[] = [];

  for (const category of item.item_data?.categories ?? []) {
    const object = category.id ? context.relatedById.get(category.id) : undefined;
    const name = object?.category_data?.name?.trim();

    if (object?.id && name) {
      entries.push({
        id: object.id,
        name,
        slug: slugifyName(name) || object.id,
        productCount: 0,
      });
    }
  }

  return entries;
}

/**
 * Square has no card ribbon, so a category named "New" or "Featured" doubles
 * as the badge. Shop managers control it from the Square Dashboard.
 */
function getRibbonText(categories: StoreCollection[]): string {
  return (
    categories.find((category) => /^(new|featured)$/i.test(category.name))?.name ?? ""
  );
}

function getDescriptions(item: SquareCatalogObject): {
  card: string;
  full: string;
} {
  const data = item.item_data;
  const full =
    data?.description_plaintext?.trim() ||
    htmlToText(data?.description_html ?? data?.description);

  return { card: truncateText(full, 96), full };
}

function mapProductDetail(
  item: SquareCatalogObject,
  slug: string,
  context: CatalogContext,
  optionValueNames: OptionValueNames,
): StoreProductDetail | null {
  const name = item.item_data?.name?.trim();
  const images = getProductImages(item, context, name ?? "");

  // Match the previous storefront contract: cards require an id, a name, and
  // at least one image before they render.
  if (!item.id || !name || !images.length) {
    return null;
  }

  const variants = mapVariants(item, context, optionValueNames, name, "");
  const visibleVariants = variants.filter((variant) => variant.visible);

  if (!visibleVariants.length) {
    return null;
  }

  const variationsById = new Map(
    (item.item_data?.variations ?? []).map((variation) => [variation.id, variation]),
  );
  const priceMonies = visibleVariants
    .map((variant) =>
      getVariationPriceMoney(variationsById.get(variant.id), context.locationId),
    )
    .filter(
      (money): money is SquareMoney => typeof money?.amount === "number",
    );
  const minPriceMoney = priceMonies.length
    ? priceMonies.reduce((min, money) =>
        (money.amount ?? 0) < (min.amount ?? 0) ? money : min,
      )
    : undefined;
  const priceValue = moneyValue(minPriceMoney);
  const price = formatMoney(minPriceMoney);
  const inStock = visibleVariants.some((variant) => variant.inStock);
  const trackedQuantities = visibleVariants
    .map((variant) => variant.quantity)
    .filter((quantity): quantity is number => quantity !== null);
  const categories = getCategoryEntries(item, context);
  const descriptions = getDescriptions(item);
  const url = `/product-page/${encodeURIComponent(slug)}`;

  return {
    id: item.id,
    slug,
    name,
    description: descriptions.card,
    price,
    priceValue,
    image: images[0]?.url ?? "",
    imageSrcSet: "",
    imageAlt: images[0]?.alt ?? name,
    url,
    inStock,
    collectionIds: categories.map((category) => category.id),
    categoryNames: categories.map((category) => category.name),
    ribbon: getRibbonText(categories),
    createdDate: item.updated_at ?? "",
    originalUrl: item.item_data?.ecom_uri?.trim() || url,
    fullDescription: descriptions.full,
    images,
    options: mapOptions(item, context, variants),
    variants,
    manageVariants: visibleVariants.length > 1,
    stockQuantity: trackedQuantities.length
      ? trackedQuantities.reduce((total, quantity) => total + quantity, 0)
      : null,
    inventoryStatus: inStock
      ? visibleVariants.every((variant) => variant.inStock)
        ? "IN_STOCK"
        : "PARTIALLY_OUT_OF_STOCK"
      : "OUT_OF_STOCK",
    additionalInfoSections: [],
  };
}

type SquareCatalog = {
  products: StoreProductDetail[];
  collections: StoreCollection[];
  productsBySlug: Map<string, StoreProductDetail>;
};

type SearchCatalogObjectsResponse = {
  objects?: SquareCatalogObject[];
  related_objects?: SquareCatalogObject[];
  cursor?: string;
};

type BatchRetrieveInventoryCountsResponse = {
  counts?: Array<{
    catalog_object_id?: string;
    location_id?: string;
    state?: string;
    quantity?: string;
  }>;
  cursor?: string;
};

async function fetchCatalogObjects(config: SquareConfig): Promise<{
  items: SquareCatalogObject[];
  relatedById: Map<string, SquareCatalogObject>;
}> {
  const items: SquareCatalogObject[] = [];
  const relatedById = new Map<string, SquareCatalogObject>();
  let cursor: string | undefined;

  do {
    const result = await squareApiRequest<SearchCatalogObjectsResponse>(
      config,
      "/v2/catalog/search",
      {
        object_types: ["ITEM"],
        include_related_objects: true,
        limit: 100,
        ...(cursor ? { cursor } : {}),
      },
    );

    items.push(...(result.objects ?? []));

    for (const object of result.related_objects ?? []) {
      if (object.id) {
        relatedById.set(object.id, object);
      }
    }

    cursor = result.cursor;
  } while (cursor);

  return { items, relatedById };
}

/** Live IN_STOCK counts per variation id at the configured location. */
async function fetchInventoryCounts(
  config: SquareConfig,
  variationIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  const chunkSize = 500;

  for (let index = 0; index < variationIds.length; index += chunkSize) {
    const chunk = variationIds.slice(index, index + chunkSize);
    let cursor: string | undefined;

    do {
      const result = await squareApiRequest<BatchRetrieveInventoryCountsResponse>(
        config,
        "/v2/inventory/counts/batch-retrieve",
        {
          catalog_object_ids: chunk,
          location_ids: [config.locationId],
          states: ["IN_STOCK"],
          ...(cursor ? { cursor } : {}),
        },
      );

      for (const count of result.counts ?? []) {
        if (count.catalog_object_id && count.state === "IN_STOCK") {
          const quantity = Number.parseFloat(count.quantity ?? "0");

          if (Number.isFinite(quantity)) {
            counts.set(
              count.catalog_object_id,
              (counts.get(count.catalog_object_id) ?? 0) + quantity,
            );
          }
        }
      }

      cursor = result.cursor;
    } while (cursor);
  }

  return counts;
}

/** Collects variation ids that need live counts (inventory tracking on). */
function getTrackedVariationIds(
  items: SquareCatalogObject[],
  locationId: string,
): string[] {
  const ids: string[] = [];

  for (const item of items) {
    for (const variation of item.item_data?.variations ?? []) {
      const data = variation.item_variation_data;
      const override = data?.location_overrides?.find(
        (entry) => entry.location_id === locationId,
      );

      if (variation.id && (override?.track_inventory ?? data?.track_inventory)) {
        ids.push(variation.id);
      }
    }
  }

  return ids;
}

/** Deterministic name-based slugs; collisions get a short item-id suffix. */
function assignSlugs(
  items: SquareCatalogObject[],
): Map<string, string> {
  const slugsByItemId = new Map<string, string>();
  const taken = new Set<string>();
  const sortedItems = [...items].sort((a, b) =>
    (a.id ?? "").localeCompare(b.id ?? ""),
  );

  for (const item of sortedItems) {
    if (!item.id) {
      continue;
    }

    const base = slugifyName(item.item_data?.name?.trim() ?? "") || item.id.toLowerCase();
    const withSuffix = `${base}-${item.id.slice(-6).toLowerCase()}`;
    const slug = taken.has(base) ? (taken.has(withSuffix) ? item.id : withSuffix) : base;

    taken.add(slug);
    slugsByItemId.set(item.id, slug);
  }

  return slugsByItemId;
}

async function loadCatalog(config: SquareConfig): Promise<SquareCatalog> {
  const { items, relatedById } = await fetchCatalogObjects(config);
  const availableItems = items.filter(
    (item) =>
      !item.is_deleted &&
      item.item_data &&
      item.item_data.is_archived !== true &&
      isPresentAtLocation(item, config.locationId),
  );
  const inventoryByVariationId = await fetchInventoryCounts(
    config,
    getTrackedVariationIds(availableItems, config.locationId),
  );
  const context: CatalogContext = {
    locationId: config.locationId,
    relatedById,
    inventoryByVariationId,
  };
  const optionValueNames = buildOptionValueNames(context);
  const slugsByItemId = assignSlugs(availableItems);
  const products: StoreProductDetail[] = [];

  for (const item of availableItems) {
    const slug = item.id ? slugsByItemId.get(item.id) : undefined;
    const product = slug
      ? mapProductDetail(item, slug, context, optionValueNames)
      : null;

    if (product) {
      products.push(product);
    }
  }

  const collections = new Map<string, StoreCollection>();

  for (const product of products) {
    for (const categoryId of product.collectionIds) {
      const object = relatedById.get(categoryId);
      const name = object?.category_data?.name?.trim();

      if (!name) {
        continue;
      }

      const existing = collections.get(categoryId) ?? {
        id: categoryId,
        name,
        slug: slugifyName(name) || categoryId,
        productCount: 0,
      };

      existing.productCount += 1;
      collections.set(categoryId, existing);
    }
  }

  return {
    products,
    collections: [...collections.values()].sort((a, b) =>
      a.name.localeCompare(b.name),
    ),
    productsBySlug: new Map(products.map((product) => [product.slug, product])),
  };
}

function getCatalog(): Promise<SquareCatalog> | null {
  const config = getSquareConfig();

  if (!config) {
    return null;
  }

  return getCachedStoreValue("square-catalog", () => loadCatalog(config));
}

function toCard(product: StoreProductDetail): StoreProductCard {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    description: product.description,
    price: product.price,
    priceValue: product.priceValue,
    image: product.image,
    imageSrcSet: product.imageSrcSet,
    imageAlt: product.imageAlt,
    url: product.url,
    inStock: product.inStock,
    collectionIds: product.collectionIds,
    categoryNames: product.categoryNames,
    ribbon: product.ribbon,
    createdDate: product.createdDate,
  };
}

function featuredProductSort(a: StoreProductCard, b: StoreProductCard): number {
  const aNew = /new/i.test(a.ribbon);
  const bNew = /new/i.test(b.ribbon);

  if (aNew !== bNew) {
    return aNew ? -1 : 1;
  }

  const aCreated = Date.parse(a.createdDate);
  const bCreated = Date.parse(b.createdDate);

  if (Number.isFinite(aCreated) && Number.isFinite(bCreated) && aCreated !== bCreated) {
    return bCreated - aCreated;
  }

  return a.name.localeCompare(b.name);
}

export async function getFeaturedStoreProducts(
  limit = 6,
): Promise<StorefrontProducts> {
  const catalogPromise = getCatalog();

  if (!catalogPromise) {
    return { products: [], allProductsUrl: defaultAllProductsUrl };
  }

  try {
    const catalog = await catalogPromise;

    return {
      products: catalog.products
        .filter((product) => product.inStock)
        .map(toCard)
        .sort(featuredProductSort)
        .slice(0, limit),
      allProductsUrl: defaultAllProductsUrl,
      collections: catalog.collections,
    };
  } catch (error) {
    console.error("Failed to load Square store products", error);
    return { products: [], allProductsUrl: defaultAllProductsUrl };
  }
}

export async function getStorefrontProducts(): Promise<StorefrontProducts> {
  const catalogPromise = getCatalog();

  if (!catalogPromise) {
    return { products: [], allProductsUrl: defaultAllProductsUrl, collections: [] };
  }

  try {
    const catalog = await catalogPromise;

    return {
      products: catalog.products.map(toCard).sort(featuredProductSort),
      allProductsUrl: defaultAllProductsUrl,
      collections: catalog.collections,
    };
  } catch (error) {
    console.error("Failed to load Square storefront products", error);
    return { products: [], allProductsUrl: defaultAllProductsUrl, collections: [] };
  }
}

export async function getStoreProductBySlug(
  slug: string,
): Promise<StoreProductDetail | null> {
  const catalogPromise = getCatalog();

  if (!catalogPromise) {
    return null;
  }

  try {
    const catalog = await catalogPromise;

    return (
      catalog.productsBySlug.get(slug) ??
      catalog.products.find((product) => product.id === slug) ??
      null
    );
  } catch (error) {
    console.error(`Failed to load Square store product ${slug}`, error);
    return null;
  }
}

export type CheckoutLineItemInput = {
  productId: string;
  productSlug: string;
  quantity: number;
  variantId?: string;
};

/**
 * Resolves the purchasable Square variation for a cart line. Multi-variant
 * products require an explicit selection; single-variation products fall back
 * to their default variation.
 */
function resolveCheckoutVariant(
  product: StoreProductDetail,
  variantId?: string,
): StoreProductVariant {
  const visibleVariants = product.variants.filter((variant) => variant.visible);
  const variant = variantId
    ? product.variants.find((item) => item.id === variantId)
    : visibleVariants.length === 1
      ? visibleVariants[0]
      : undefined;

  if (!variant) {
    throw new Error("Please select a product option.");
  }

  if (!variant.visible || !variant.inStock) {
    throw new Error("The selected product option is not available.");
  }

  return variant;
}

async function buildCheckoutLineItem(item: CheckoutLineItemInput) {
  const product = await getStoreProductBySlug(item.productSlug);

  if (!product || product.id !== item.productId || !product.inStock) {
    throw new Error("This product is not available.");
  }

  const variant = resolveCheckoutVariant(product, item.variantId);

  return {
    catalog_object_id: variant.id,
    quantity: String(item.quantity),
  };
}

type CreatePaymentLinkResponse = {
  payment_link?: {
    url?: string;
    long_url?: string;
  };
};

export async function createCheckoutUrlForCart(
  items: CheckoutLineItemInput[],
): Promise<string> {
  if (!items.length) {
    throw new Error("Your cart is empty.");
  }

  const config = getSquareConfig();

  if (!config) {
    throw new Error("SQUARE_ACCESS_TOKEN or SQUARE_LOCATION_ID is not set.");
  }

  const lineItems = await Promise.all(items.map(buildCheckoutLineItem));
  const result = await squareApiRequest<CreatePaymentLinkResponse>(
    config,
    "/v2/online-checkout/payment-links",
    {
      idempotency_key: crypto.randomUUID(),
      order: {
        location_id: config.locationId,
        line_items: lineItems,
      },
    },
  );
  const checkoutUrl = result.payment_link?.url ?? result.payment_link?.long_url;

  if (!checkoutUrl) {
    throw new Error("Square did not return a checkout URL.");
  }

  return checkoutUrl;
}

export async function createCheckoutUrlForProduct(
  item: CheckoutLineItemInput,
): Promise<string> {
  return createCheckoutUrlForCart([item]);
}
