import type { APIRoute } from "astro";
import {
  createCheckoutUrlForCart,
  type CheckoutLineItemInput,
} from "../../lib/square-store";

function getString(formData: FormData, key: string): string {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function getQuantity(value: unknown): number {
  const quantity = Number.parseInt(String(value), 10);

  if (!Number.isFinite(quantity)) {
    return 1;
  }

  return Math.min(100, Math.max(1, quantity));
}

function parseCartItems(raw: string): CheckoutLineItemInput[] {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  const items: CheckoutLineItemInput[] = [];

  for (const entry of parsed) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const record = entry as Record<string, unknown>;
    const productId =
      typeof record.productId === "string" ? record.productId.trim() : "";
    const productSlug =
      typeof record.productSlug === "string" ? record.productSlug.trim() : "";

    if (!productId || !productSlug) {
      continue;
    }

    const variantId =
      typeof record.variantId === "string" && record.variantId.trim()
        ? record.variantId.trim()
        : undefined;

    items.push({
      productId,
      productSlug,
      variantId,
      quantity: getQuantity(record.quantity),
    });
  }

  return items;
}

export const POST: APIRoute = async ({ request, redirect }) => {
  const formData = await request.formData();
  const cartPayload = getString(formData, "cart");
  const productSlug = getString(formData, "productSlug");
  const fallbackPath = cartPayload
    ? "/shop?checkout=error"
    : productSlug
      ? `/product-page/${encodeURIComponent(productSlug)}?checkout=error`
      : "/shop?checkout=error";

  const items = cartPayload
    ? parseCartItems(cartPayload)
    : [
        {
          productId: getString(formData, "productId"),
          productSlug,
          variantId: getString(formData, "variantId") || undefined,
          quantity: getQuantity(getString(formData, "quantity")),
        },
      ];

  try {
    const checkoutUrl = await createCheckoutUrlForCart(items);

    return redirect(checkoutUrl, 303);
  } catch (error) {
    console.error("Failed to create Square checkout", error);
    return redirect(fallbackPath, 303);
  }
};
