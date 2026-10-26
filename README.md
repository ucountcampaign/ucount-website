# U COUNT Self-Managed Headless Site

This is the self-managed Astro version of the U COUNT redesign. It deploys outside Wix. The official Wix site remains the backend for CMS content, events, and the contact form. The marketplace reads products, categories, and stock directly from Square, and checkout uses Square-hosted Payment Links.

## Setup

```sh
pnpm install
cp .env.example .env
```

Set `WIX_SITE_ID` to the ID of the official Wix site.

Set separate server-only API keys for each Wix surface:

- `WIX_DATA_API_KEY` for Wix CMS data reads.
- `WIX_EVENTS_API_KEY` for Wix Events reads. If omitted, the site falls back to
  `WIX_DATA_API_KEY`; the key used must have the Wix Events "Read Events"
  permission.
- `WIX_FORMS_API_KEY` for Wix Forms submissions.

Set the Square credentials for the marketplace:

- `SQUARE_ACCESS_TOKEN` — a Square application access token with catalog,
  inventory, and orders permissions. Create it at
  https://developer.squareup.com in the account that owns the store.
- `SQUARE_LOCATION_ID` — the Square location whose stock and checkout the
  site uses (Square Dashboard → Account → Locations, or `GET /v2/locations`).
- `SQUARE_ENVIRONMENT` — set to `sandbox` to point at
  `connect.squareupsandbox.com` with a sandbox token. Defaults to production.

The shop degrades gracefully when the Square credentials are missing: pages
render with an empty product grid and checkout returns to the shop with an
error banner.

Products need a name, at least one image (on the item or a variation), and a
fixed price before they appear on the site; variable-price variations are
skipped because hosted checkout cannot ask for a sale-time price. Gift cards,
appointment services, archived items, and items hidden from Square Online do
not appear. A Square category named `New` or `Featured` shows as the card badge
and pins those products first in the featured section. Checkout happens on the
Square-hosted payment page (`checkout.square.site`).

To submit the Astro contact form into Wix Forms, set `WIX_CONTACT_FORM_ID`. The
forms key needs the Wix Forms "Manage Form Submissions" permission. This site
uses the modern Wix Forms `Astro Contact Form` schema:

```sh
WIX_CONTACT_FORM_ID="1a784f54-c174-4349-8d67-7dbf93214af5"
WIX_CONTACT_FIELD_FIRST_NAME="first_name_5b78"
WIX_CONTACT_FIELD_LAST_NAME="last_name_3ab0"
WIX_CONTACT_FIELD_EMAIL="email_df1a"
WIX_CONTACT_FIELD_MESSAGE="message"
```

The legacy editor contact page uses Old Wix Forms and Payments, and its DOM IDs
such as `comp-*` are not valid IDs for the public Forms v4 submissions API.

The Astro form requires first name, email, and message. Last name is submitted
when provided but is optional. The configured Wix form should have notifications
or automations enabled for the recipients who should receive the email.

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
marketplace, product pages, checkout API, and contact API render server-side on
Cloudflare Workers. Cache durations are centralized in `src/lib/cache.ts`. Square
catalog, Wix events, and Wix CMS reads are memoized in the serverless function
process for 60 seconds. Wix CMS reads keep stale successful values for one hour if Wix is
temporarily unavailable, and short-cache failures for 30 seconds so a Wix
timeout does not cause every request to retry immediately. Page content sections
are loaded once per page key and shared by `getPageSection()` calls.

Public cached pages and generated routes send:

```txt
Cache-Control: public, max-age=60, s-maxage=60, stale-while-revalidate=3600
```

Product images are served from Square's CDN at their uploaded size; Square does
not offer on-the-fly resize parameters, so keep catalog uploads reasonably sized.
CMS and event images are still served by Wix with responsive `srcset` variants.

## Build

```sh
pnpm build
```

## Deployment

This project is configured for Cloudflare Workers through `@astrojs/cloudflare`.
It is not a static Cloudflare Pages deployment; the checkout/contact API routes
and Wix-backed dynamic pages require the Worker runtime.

Build and deploy with Wrangler:

```sh
pnpm run deploy
```

For a local production-like preview, build first and then run:

```sh
pnpm preview
```

Add the same server-side environment variables in Cloudflare Workers as needed.
Set `PUBLIC_SITE_URL` to the canonical production origin.

Do not copy `.env.local` or Wix-managed credentials from the old `ucount-headless` project into this repo.

## Validation checklist

After configuring the Square credentials (sandbox first, then production),
validate these paths and flows:

- `/shop` serves the Astro marketplace with the products from the Square catalog.
- `/product-page/<slug>` serves the Astro product detail page for several Square products. Slugs derive from the Square item name.
- `/contact-us-1` redirects to `/contact`.
- Checkout redirects to a Square-hosted payment link (`checkout.square.site`), not Astro's primary domain. In sandbox, Square's test card numbers complete the payment.
- A product with options creates checkout with the selected variation and quantity.
- Out-of-stock products and out-of-stock variations cannot start checkout, and stock counts match the Square Dashboard for the configured location.
- A Square category named `New` or `Featured` appears as a badge on matching Astro product cards.
- Contact form submissions land in Wix Forms after the Forms API permission and field keys are configured.
