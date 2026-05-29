# U COUNT Self-Managed Headless Site

This is the self-managed Astro version of the U COUNT redesign. It is intended to deploy outside Wix while using the official Wix site as the backend for CMS and Store data.

## Setup

```sh
pnpm install
cp .env.example .env
```

Set `WIX_CLIENT_ID` to the Headless client ID from the official Wix site dashboard.

Set `WIX_SITE_ID` and a server-only `WIX_API_KEY` for store catalog and checkout
access. The same API key needs eCommerce checkout permissions if the Astro
product pages should send visitors directly to Wix checkout.

If Wix returns checkout URLs on the same domain as the Astro deployment, set
`WIX_CHECKOUT_BASE_URL` to the separate Wix-managed checkout domain so `/checkout`
does not get handled by Astro.

To submit the Astro contact form into Wix Forms, set `WIX_CONTACT_FORM_ID` and
the field-key variables from the Wix Forms schema. The API key also needs the
Wix Forms "Manage Submissions" permission.

If a CMS collection was created manually and Wix assigned an immutable collection ID
like `Import1`, map the app's expected collection name to that real ID:

```sh
WIX_CMS_COLLECTION_ALIASES='{"SiteSettings":"Import1"}'
```

## Development

```sh
pnpm dev
```

## Runtime and caching

Astro is configured with `output: "server"` and the Cloudflare adapter, so the
marketplace and product pages render server-side. Wix store reads are memoized in
the Worker process for five minutes, and the storefront pages send:

```txt
Cache-Control: public, max-age=60, s-maxage=300, stale-while-revalidate=3600
```

Product images are still served by Wix, but the Astro storefront requests smaller
Wix image variants with responsive `srcset` values so the browser does not pull
the original 2000px catalog images for every card.

## Build

```sh
pnpm build
```

## Deployment

This project is currently configured for Cloudflare Pages/Workers through `@astrojs/cloudflare`. Add the same environment variables in the deployment platform.

Do not copy `.env.local` or Wix-managed credentials from the old `ucount-headless` project into this repo.

## Wix headless validation checklist

After updating the valid redirect URLs in Wix Headless settings and moving the
canonical domain to Astro, validate these paths and flows:

- `/shop` serves the Astro marketplace, not the legacy Wix editor page.
- `/product-page/<slug>` serves the Astro product detail page for several Wix products.
- `/contact-us-1` redirects to `/contact`.
- `/checkout` stays routed to Wix checkout, or `WIX_CHECKOUT_BASE_URL` rewrites checkout URLs to a Wix-managed checkout host.
- The checkout "Continue Browsing" link returns shoppers to the Astro marketplace.
- A product with options creates checkout with the selected variant and quantity.
- Out-of-stock products and out-of-stock variants cannot start checkout.
- New Product ribbons from Wix Store appear on matching Astro product cards.
- Contact form submissions land in Wix Forms after the Forms API permission and field keys are configured.
- Preview/staging origins used for QA are present in Wix valid redirects before testing checkout there.
