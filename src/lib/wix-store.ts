import { ApiKeyStrategy, createClient } from "@wix/sdk";
import { products } from "@wix/stores";

type WixPriceData = {
  currency?: string;
  price?: number | null;
  discountedPrice?: number;
  formatted?: {
    price?: string;
    discountedPrice?: string;
  };
};

type WixStoreProduct = {
  _id?: string;
  name?: string | null;
  visible?: boolean | null;
  description?: string | null;
  stock?: {
    inStock?: boolean;
    inventoryStatus?: string;
  };
  price?: WixPriceData;
  priceData?: WixPriceData;
  media?: {
    mainMedia?: {
      title?: string;
      image?: {
        url?: string;
        altText?: string | null;
      };
      thumbnail?: {
        url?: string;
        altText?: string | null;
      };
    };
  };
  productPageUrl?: {
    base?: string;
    path?: string;
  };
};

export type StoreProductCard = {
  id: string;
  name: string;
  description: string;
  price: string;
  image: string;
  imageAlt: string;
  url: string;
};

export type StorefrontProducts = {
  products: StoreProductCard[];
  allProductsUrl: string;
};

const defaultAllProductsUrl =
  "https://www.ucountcampaign.org/shop";

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

function createWixStoreClient() {
  const apiKey = import.meta.env.WIX_API_KEY;
  const siteId = import.meta.env.WIX_SITE_ID;

  if (!apiKey || !siteId) {
    return null;
  }

  return createClient({
    modules: { products },
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
      "WIX_API_KEY or WIX_SITE_ID is not set; store products will be unavailable.",
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

function getProductUrl(product: WixStoreProduct): string {
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

function getAllProductsUrl(products: WixStoreProduct[]): string {
  const base = products.find((product) => product.productPageUrl?.base)
    ?.productPageUrl?.base;

  if (!base) {
    return defaultAllProductsUrl;
  }

  try {
    return new URL("/shop", base).toString();
  } catch {
    return defaultAllProductsUrl;
  }
}

function isVisibleProduct(product: WixStoreProduct): boolean {
  if (product.visible === false) {
    return false;
  }

  if (product.stock?.inventoryStatus === "OUT_OF_STOCK") {
    return false;
  }

  return product.stock?.inStock !== false;
}

function mapProduct(product: WixStoreProduct): StoreProductCard | null {
  const name = product.name?.trim();
  const image =
    product.media?.mainMedia?.image?.url ??
    product.media?.mainMedia?.thumbnail?.url;

  if (!product._id || !name || !image || !isVisibleProduct(product)) {
    return null;
  }

  const description = truncateText(htmlToText(product.description), 96);
  const imageAlt =
    product.media?.mainMedia?.image?.altText?.trim() ||
    product.media?.mainMedia?.thumbnail?.altText?.trim() ||
    name;

  return {
    id: product._id,
    name,
    description,
    price: getPrice(product),
    image,
    imageAlt,
    url: getProductUrl(product),
  };
}

export async function getFeaturedStoreProducts(
  limit = 6,
): Promise<StorefrontProducts> {
  const client = getWixStoreClient();

  if (!client) {
    return { products: [], allProductsUrl: defaultAllProductsUrl };
  }

  try {
    const pageSize = Math.min(100, Math.max(limit * 4, limit));
    const sourceProducts: WixStoreProduct[] = [];
    const productCards: StoreProductCard[] = [];
    let result = await client.products.queryProducts().limit(pageSize).find();

    while (true) {
      for (const product of result.items as WixStoreProduct[]) {
        sourceProducts.push(product);

        const productCard = mapProduct(product);

        if (productCard) {
          productCards.push(productCard);
        }

        if (productCards.length >= limit) {
          break;
        }
      }

      if (productCards.length >= limit || !result.hasNext()) {
        break;
      }

      result = await result.next();
    }

    return {
      products: productCards.slice(0, limit),
      allProductsUrl: getAllProductsUrl(sourceProducts),
    };
  } catch (error) {
    console.error("Failed to load Wix store products", error);
    return { products: [], allProductsUrl: defaultAllProductsUrl };
  }
}
