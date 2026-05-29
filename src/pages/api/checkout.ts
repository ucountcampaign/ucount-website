import type { APIRoute } from "astro";
import { createCheckoutUrlForProduct } from "../../lib/wix-store";

function getString(formData: FormData, key: string): string {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function getQuantity(value: string): number {
  const quantity = Number.parseInt(value, 10);

  if (!Number.isFinite(quantity)) {
    return 1;
  }

  return Math.min(100, Math.max(1, quantity));
}

export const POST: APIRoute = async ({ request, redirect }) => {
  const formData = await request.formData();
  const productSlug = getString(formData, "productSlug");
  const productId = getString(formData, "productId");
  const variantId = getString(formData, "variantId") || undefined;
  const quantity = getQuantity(getString(formData, "quantity"));
  const fallbackPath = productSlug
    ? `/product-page/${encodeURIComponent(productSlug)}`
    : "/shop";

  try {
    const checkoutUrl = await createCheckoutUrlForProduct({
      productId,
      productSlug,
      quantity,
      variantId,
    });

    return redirect(checkoutUrl, 303);
  } catch (error) {
    console.error("Failed to create Wix checkout", error);
    return redirect(`${fallbackPath}?checkout=error`, 303);
  }
};
