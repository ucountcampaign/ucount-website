import { ApiKeyStrategy, createClient } from "@wix/sdk";
import { collections, products } from "@wix/stores";
import { siteCacheTtlMs } from "./cache";
import { createWixImageSrcSet, resizeWixImageUrl } from "./images";
import { getEnv } from "./runtime-env";

const WIX_STORES_APP_ID = "215238eb-22a5-4c36-9e7b-e7c08025e04e";

type WixPriceData = {
  currency?: string;
  price?: number | null;
  discountedPrice?: number;
  formatted?: {
    price?: string;
    discountedPrice?: string;
  };
};

type WixMediaItem = {
  _id?: string;
  title?: string;
  mediaType?: string;
  image?: {
    url?: string;
    altText?: string | null;
    width?: number;
    height?: number;
  };
  thumbnail?: {
    url?: string;
    altText?: string | null;
    width?: number;
    height?: number;
  };
};

type WixProductOptionChoice = {
  value?: string | null;
  description?: string | null;
  inStock?: boolean;
  visible?: boolean;
  media?: {
    mainMedia?: WixMediaItem;
    items?: WixMediaItem[];
  };
};

type WixProductOption = {
  name?: string | null;
  optionType?: string | null;
  choices?: WixProductOptionChoice[];
};

type WixProductVariant = {
  _id?: string;
  choices?: Record<string, string>;
  variant?: {
    priceData?: WixPriceData;
    convertedPriceData?: WixPriceData;
    sku?: string | null;
    visible?: boolean;
  };
  stock?: {
    inStock?: boolean;
    quantity?: number;
    trackQuantity?: boolean;
  };
};

type WixStoreProduct = {
  _id?: string;
  _createdDate?: string | Date;
  name?: string | null;
  slug?: string | null;
  visible?: boolean | null;
  manageVariants?: boolean;
  ribbon?: string | null;
  ribbons?: Array<{
    text?: string | null;
  }>;
  description?: string | null;
  stock?: {
    quantity?: number;
    inStock?: boolean;
    inventoryStatus?: string;
  };
  price?: WixPriceData;
  priceData?: WixPriceData;
  collectionIds?: string[];
  additionalInfoSections?: Array<{
    title?: string | null;
    description?: string | null;
  }>;
  media?: {
    mainMedia?: WixMediaItem;
    items?: WixMediaItem[];
  };
  productOptions?: WixProductOption[];
  productPageUrl?: {
    base?: string;
    path?: string;
  };
  variants?: WixProductVariant[];
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

function createWixStoreClient() {
  const apiKey = getEnv("WIX_STORES_API_KEY");
  const siteId = getEnv("WIX_SITE_ID");

  if (!apiKey || !siteId) {
    return null;
  }

  return createClient({
    modules: { collections, products },
    auth: ApiKeyStrategy({ apiKey, siteId }),
  });
}

let wixStoreClient: ReturnType<typeof createWixStoreClient> | undefined;
let missingStoreCredentialsWarningShown = false;

function getWixStoreClient() {
  wixStoreClient ??= createWixStoreClient();

  if (!wixStoreClient && !missingStoreCredentialsWarningShown) {
    missingStoreCredentialsWarningShown = true;
    console.warn(
      "WIX_STORES_API_KEY or WIX_SITE_ID is not set; store products will be unavailable.",
    );
  }

  return wixStoreClient;
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

function formatFallbackPrice(priceData: WixPriceData): string {
  const value = priceData.discountedPrice ?? priceData.price;

  if (typeof value !== "number") {
    return "";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: priceData.currency ?? "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function getPrice(product: WixStoreProduct): string {
  const priceData = product.priceData ?? product.price;

  if (!priceData) {
    return "";
  }

  return (
    priceData.formatted?.discountedPrice ??
    priceData.formatted?.price ??
    formatFallbackPrice(priceData)
  );
}

function getPriceValue(product: WixStoreProduct): number | null {
  const priceData = product.priceData ?? product.price;
  const value = priceData?.discountedPrice ?? priceData?.price;

  return typeof value === "number" ? value : null;
}

function getProductUrl(product: WixStoreProduct): string {
  const slug = product.slug?.trim();

  if (slug) {
    return `/product-page/${encodeURIComponent(slug)}`;
  }

  return getOriginalProductUrl(product);
}

function getOriginalProductUrl(product: WixStoreProduct): string {
  const base = product.productPageUrl?.base;
  const path = product.productPageUrl?.path;

  try {
    if (base && path) {
      return new URL(path, base).toString();
    }

    if (path) {
      return new URL(path, defaultAllProductsUrl).toString();
    }

    return base ?? defaultAllProductsUrl;
  } catch {
    return defaultAllProductsUrl;
  }
}

function getAllProductsUrl(): string {
  return defaultAllProductsUrl;
}

function isPublishedProduct(product: WixStoreProduct): boolean {
  return product.visible !== false;
}

function isPurchasableProduct(product: WixStoreProduct): boolean {
  if (!isPublishedProduct(product)) {
    return false;
  }

  if (product.stock?.inventoryStatus === "OUT_OF_STOCK") {
    return false;
  }

  return product.stock?.inStock !== false;
}

function mapMediaItem(
  media: WixMediaItem | null | undefined,
  fallbackAlt: string,
): StoreProductImage | null {
  const url = media?.image?.url ?? media?.thumbnail?.url;

  if (!url) {
    return null;
  }

  return {
    id: media?._id ?? url,
    url: resizeWixImageUrl(url, { width: 1200, height: 1200 }),
    thumbnailUrl: resizeWixImageUrl(media?.thumbnail?.url ?? url, {
      width: 160,
      height: 160,
      mode: "fill",
    }),
    fullUrl: url,
    srcSet: createWixImageSrcSet(
      url,
      [
        { width: 640, height: 640 },
        { width: 960, height: 960 },
        { width: 1200, height: 1200 },
      ],
      "fit",
    ),
    alt:
      media?.image?.altText?.trim() ||
      media?.thumbnail?.altText?.trim() ||
      media?.title?.trim() ||
      fallbackAlt,
  };
}

function getProductImages(product: WixStoreProduct, name: string): StoreProductImage[] {
  const mediaItems = product.media?.items?.length
    ? product.media.items
    : [product.media?.mainMedia];
  const seen = new Set<string>();
  const images: StoreProductImage[] = [];

  for (const media of mediaItems) {
    const image = mapMediaItem(media, name);

    if (!image || seen.has(image.url)) {
      continue;
    }

    seen.add(image.url);
    images.push(image);
  }

  return images;
}

function getChoiceLabel(choice: WixProductOptionChoice): string {
  return choice.description?.trim() || choice.value?.trim() || "";
}

function getVariantLabel(variant: WixProductVariant, fallback: string): string {
  const values = Object.values(variant.choices ?? {}).filter(Boolean);

  return values.length ? values.join(" / ") : fallback;
}

function findVariantImage(
  product: WixStoreProduct,
  variant: WixProductVariant,
  fallbackAlt: string,
): StoreProductImage | undefined {
  const variantChoices = Object.entries(variant.choices ?? {});

  for (const [optionName, choiceValue] of variantChoices) {
    const option = product.productOptions?.find(
      (item) => item.name?.trim() === optionName,
    );
    const choice = option?.choices?.find(
      (item) => getChoiceLabel(item) === choiceValue,
    );
    const image = mapMediaItem(
      choice?.media?.mainMedia ?? choice?.media?.items?.[0],
      `${fallbackAlt} - ${choiceValue}`,
    );

    if (image) {
      return image;
    }
  }

  return undefined;
}

function getVariantQuantity(variant: WixProductVariant): number | null {
  if (variant.stock?.trackQuantity && typeof variant.stock?.quantity === "number") {
    return Math.max(0, variant.stock.quantity);
  }

  return null;
}

function getVariantPrice(variant: WixProductVariant, fallback: string): string {
  const priceData = variant.variant?.priceData ?? variant.variant?.convertedPriceData;

  if (!priceData) {
    return fallback;
  }

  return (
    priceData.formatted?.discountedPrice ??
    priceData.formatted?.price ??
    formatFallbackPrice(priceData)
  );
}

function mapOptions(product: WixStoreProduct, name: string): StoreProductOption[] {
  return (product.productOptions ?? [])
    .map((option) => {
      const optionName = option.name?.trim();

      if (!optionName) {
        return null;
      }

      return {
        name: optionName,
        type: option.optionType ?? "drop_down",
        choices: (option.choices ?? [])
          .map((choice) => {
            const label = getChoiceLabel(choice);

            if (!label) {
              return null;
            }

            return {
              label,
              swatch: choice.value?.trim() ?? "",
              inStock: choice.inStock !== false,
              visible: choice.visible !== false,
              image:
                mapMediaItem(
                  choice.media?.mainMedia ?? choice.media?.items?.[0],
                  `${name} - ${label}`,
                ) ?? undefined,
            };
          })
          .filter((choice): choice is StoreProductOptionChoice => Boolean(choice)),
      };
    })
    .filter((option): option is StoreProductOption => Boolean(option));
}

function mapVariants(
  product: WixStoreProduct,
  name: string,
  fallbackPrice: string,
): StoreProductVariant[] {
  return (product.variants ?? [])
    .map((variant) => {
      const id = variant._id?.trim();

      if (!id) {
        return null;
      }

      return {
        id,
        label: getVariantLabel(variant, name),
        choices: variant.choices ?? {},
        price: getVariantPrice(variant, fallbackPrice),
        sku: variant.variant?.sku?.trim() ?? "",
        visible: variant.variant?.visible !== false,
        inStock: variant.stock?.inStock !== false,
        quantity: getVariantQuantity(variant),
        image: findVariantImage(product, variant, name),
      };
    })
    .filter((variant): variant is StoreProductVariant => Boolean(variant));
}

function getCategoryNames(
  collectionIds: string[],
  collectionsById?: Map<string, StoreCollection>,
): string[] {
  return collectionIds
    .map((id) => collectionsById?.get(id)?.name)
    .filter((name): name is string => Boolean(name) && name !== "All Products");
}

function getRibbonText(product: WixStoreProduct): string {
  return (
    product.ribbon?.trim() ||
    product.ribbons?.map((ribbon) => ribbon.text?.trim()).find(Boolean) ||
    ""
  );
}

function getCreatedDate(product: WixStoreProduct): string {
  if (!product._createdDate) {
    return "";
  }

  if (product._createdDate instanceof Date) {
    return product._createdDate.toISOString();
  }

  return product._createdDate;
}

function featuredProductSort(a: StoreProductCard, b: StoreProductCard): number {
  const aNew = /new/i.test(a.ribbon);
  const bNew = /new/i.test(b.ribbon);

  if (aNew !== bNew) {
    return aNew ? -1 : 1;
  }

  const aCreated = Date.parse(a.createdDate);
  const bCreated = Date.parse(b.createdDate);

  if (Number.isFinite(aCreated) && Number.isFinite(bCreated)) {
    return bCreated - aCreated;
  }

  return a.name.localeCompare(b.name);
}

function mapProductCard(
  product: WixStoreProduct,
  collectionsById?: Map<string, StoreCollection>,
  includeOutOfStock = false,
): StoreProductCard | null {
  const name = product.name?.trim();
  const slug = product.slug?.trim();
  const image =
    product.media?.mainMedia?.image?.url ??
    product.media?.mainMedia?.thumbnail?.url ??
    product.media?.items?.[0]?.image?.url ??
    product.media?.items?.[0]?.thumbnail?.url;

  if (!product._id || !name || !slug || !image || !isPublishedProduct(product)) {
    return null;
  }

  if (!includeOutOfStock && !isPurchasableProduct(product)) {
    return null;
  }

  const description = truncateText(htmlToText(product.description), 96);
  const collectionIds = product.collectionIds ?? [];
  const imageAlt =
    product.media?.mainMedia?.image?.altText?.trim() ||
    product.media?.mainMedia?.thumbnail?.altText?.trim() ||
    name;

  return {
    id: product._id,
    slug,
    name,
    description,
    price: getPrice(product),
    priceValue: getPriceValue(product),
    image: resizeWixImageUrl(image, {
      width: 640,
      height: 800,
      mode: "fill",
    }),
    imageSrcSet: createWixImageSrcSet(
      image,
      [
        { width: 360, height: 450 },
        { width: 520, height: 650 },
        { width: 640, height: 800 },
      ],
      "fill",
    ),
    imageAlt,
    url: getProductUrl(product),
    inStock: isPurchasableProduct(product),
    collectionIds,
    categoryNames: getCategoryNames(collectionIds, collectionsById),
    ribbon: getRibbonText(product),
    createdDate: getCreatedDate(product),
  };
}

function mapCollection(collection: {
  _id?: string;
  name?: string | null;
  slug?: string | null;
  visible?: boolean | null;
  numberOfProducts?: number | null;
}): StoreCollection | null {
  const id = collection._id?.trim();
  const name = collection.name?.trim();
  const slug = collection.slug?.trim();

  if (!id || !name || !slug || collection.visible === false) {
    return null;
  }

  return {
    id,
    name,
    slug,
    productCount: collection.numberOfProducts ?? 0,
  };
}

function mapProductDetail(
  product: WixStoreProduct,
  collectionsById?: Map<string, StoreCollection>,
): StoreProductDetail | null {
  const card = mapProductCard(product, collectionsById, true);

  if (!card) {
    return null;
  }

  const images = getProductImages(product, card.name);
  const price = getPrice(product);

  return {
    ...card,
    originalUrl: getOriginalProductUrl(product),
    fullDescription: htmlToText(product.description),
    images,
    options: mapOptions(product, card.name),
    variants: mapVariants(product, card.name, price),
    manageVariants: product.manageVariants === true,
    stockQuantity:
      typeof product.stock?.quantity === "number" ? product.stock.quantity : null,
    inventoryStatus: product.stock?.inventoryStatus ?? "",
    additionalInfoSections: (product.additionalInfoSections ?? [])
      .map((section) => ({
        title: section.title?.trim() ?? "",
        body: htmlToText(section.description),
      }))
      .filter((section) => section.title || section.body),
  };
}

async function queryAllProducts(client: NonNullable<ReturnType<typeof getWixStoreClient>>) {
  const allProducts: WixStoreProduct[] = [];
  let result = await client.products.queryProducts().limit(100).find();

  while (true) {
    allProducts.push(...(result.items as WixStoreProduct[]));

    if (!result.hasNext()) {
      break;
    }

    result = await result.next();
  }

  return allProducts;
}

async function queryStoreCollections(
  client: NonNullable<ReturnType<typeof getWixStoreClient>>,
): Promise<StoreCollection[]> {
  try {
    const result = await client.collections.queryCollections().limit(100).find();

    return result.items
      .map(mapCollection)
      .filter((collection): collection is StoreCollection => Boolean(collection));
  } catch (error) {
    console.error("Failed to load Wix store collections", error);
    return [];
  }
}

function collectionMap(collections: StoreCollection[]) {
  return new Map(collections.map((collection) => [collection.id, collection]));
}

export async function getFeaturedStoreProducts(
  limit = 6,
): Promise<StorefrontProducts> {
  const client = getWixStoreClient();

  if (!client) {
    return { products: [], allProductsUrl: defaultAllProductsUrl };
  }

  try {
    return await getCachedStoreValue(`featured-products:${limit}`, async () => {
      const [sourceProducts, storeCollections] = await Promise.all([
        queryAllProducts(client),
        queryStoreCollections(client),
      ]);
      const collectionsById = collectionMap(storeCollections);
      const productCards = sourceProducts
        .map((product) => mapProductCard(product, collectionsById))
        .filter((product): product is StoreProductCard => Boolean(product))
        .sort(featuredProductSort);

      return {
        products: productCards.slice(0, limit),
        allProductsUrl: getAllProductsUrl(),
        collections: storeCollections,
      };
    });
  } catch (error) {
    console.error("Failed to load Wix store products", error);
    return { products: [], allProductsUrl: defaultAllProductsUrl };
  }
}

export async function getStorefrontProducts(): Promise<StorefrontProducts> {
  const client = getWixStoreClient();

  if (!client) {
    return { products: [], allProductsUrl: defaultAllProductsUrl, collections: [] };
  }

  try {
    return await getCachedStoreValue("storefront-products", async () => {
      const [sourceProducts, storeCollections] = await Promise.all([
        queryAllProducts(client),
        queryStoreCollections(client),
      ]);
      const collectionsById = collectionMap(storeCollections);

      return {
        products: sourceProducts
          .map((product) => mapProductCard(product, collectionsById, true))
          .filter((product): product is StoreProductCard => Boolean(product))
          .sort(featuredProductSort),
        allProductsUrl: getAllProductsUrl(),
        collections: storeCollections.filter(
          (collection) => collection.name !== "All Products",
        ),
      };
    });
  } catch (error) {
    console.error("Failed to load Wix storefront products", error);
    return { products: [], allProductsUrl: defaultAllProductsUrl, collections: [] };
  }
}

export async function getStoreProductBySlug(
  slug: string,
): Promise<StoreProductDetail | null> {
  const client = getWixStoreClient();

  if (!client) {
    return null;
  }

  try {
    return await getCachedStoreValue(`store-product:${slug}`, async () => {
      const [productResult, storeCollections] = await Promise.all([
        client.products.queryProducts().eq("slug", slug).limit(1).find(),
        queryStoreCollections(client),
      ]);
      const product = (productResult.items as WixStoreProduct[])[0];

      if (!product) {
        return null;
      }

      return mapProductDetail(product, collectionMap(storeCollections));
    });
  } catch (error) {
    console.error(`Failed to load Wix store product ${slug}`, error);
    return null;
  }
}

function wixApiHeaders() {
  const apiKey = getEnv("WIX_STORES_API_KEY");
  const siteId = getEnv("WIX_SITE_ID");

  if (!apiKey || !siteId) {
    throw new Error("WIX_STORES_API_KEY or WIX_SITE_ID is not set.");
  }

  return {
    Authorization: apiKey,
    "Content-Type": "application/json",
    "wix-site-id": siteId,
  };
}

async function wixApiRequest<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`https://www.wixapis.com${path}`, {
    method: body ? "POST" : "GET",
    headers: wixApiHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  const data = text ? (JSON.parse(text) as T & { message?: string }) : ({} as T);

  if (!response.ok) {
    throw new Error(
      data.message ||
        `Wix API request failed with ${response.status} ${response.statusText}`,
    );
  }

  return data;
}

function resolveCheckoutUrl(checkoutUrl: string): string {
  const checkoutBaseUrl = getEnv("WIX_CHECKOUT_BASE_URL");

  if (!checkoutBaseUrl) {
    return checkoutUrl;
  }

  try {
    const sourceUrl = new URL(checkoutUrl);
    return new URL(`${sourceUrl.pathname}${sourceUrl.search}`, checkoutBaseUrl)
      .toString();
  } catch {
    return checkoutUrl;
  }
}

function getCheckoutOptions(product: StoreProductDetail, variantId?: string) {
  if (!product.manageVariants) {
    return undefined;
  }

  const variant =
    product.variants.find((item) => item.id === variantId) ??
    (product.variants.length === 1 ? product.variants[0] : undefined);

  if (!variant) {
    throw new Error("Please select a product option.");
  }

  if (!variant.visible || !variant.inStock) {
    throw new Error("The selected product option is not available.");
  }

  return { variantId: variant.id };
}

export type CheckoutLineItemInput = {
  productId: string;
  productSlug: string;
  quantity: number;
  variantId?: string;
};

async function buildCheckoutLineItem(item: CheckoutLineItemInput) {
  const product = await getStoreProductBySlug(item.productSlug);

  if (!product || product.id !== item.productId || !product.inStock) {
    throw new Error("This product is not available.");
  }

  const options = getCheckoutOptions(product, item.variantId);

  return {
    quantity: item.quantity,
    catalogReference: {
      appId: WIX_STORES_APP_ID,
      catalogItemId: product.id,
      ...(options ? { options } : {}),
    },
  };
}

export async function createCheckoutUrlForCart(
  items: CheckoutLineItemInput[],
): Promise<string> {
  if (!items.length) {
    throw new Error("Your cart is empty.");
  }

  const lineItems = await Promise.all(items.map(buildCheckoutLineItem));
  const createCheckoutResult = await wixApiRequest<{
    checkout?: { _id?: string; id?: string; checkoutUrl?: string };
  }>("/ecom/v1/checkouts", {
    channelType: "WEB",
    lineItems,
  });

  if (createCheckoutResult.checkout?.checkoutUrl) {
    return resolveCheckoutUrl(createCheckoutResult.checkout.checkoutUrl);
  }

  const checkoutId =
    createCheckoutResult.checkout?._id ?? createCheckoutResult.checkout?.id;

  if (!checkoutId) {
    throw new Error("Wix did not return a checkout ID.");
  }

  const checkoutUrlResult = await wixApiRequest<{ checkoutUrl?: string }>(
    `/ecom/v1/checkouts/${checkoutId}/checkout-url`,
  );

  if (!checkoutUrlResult.checkoutUrl) {
    throw new Error("Wix did not return a checkout URL.");
  }

  return resolveCheckoutUrl(checkoutUrlResult.checkoutUrl);
}

export async function createCheckoutUrlForProduct(
  item: CheckoutLineItemInput,
): Promise<string> {
  return createCheckoutUrlForCart([item]);
}
