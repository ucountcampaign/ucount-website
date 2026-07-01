# U COUNT Self-Managed Headless Site

This is the self-managed Astro version of the U COUNT redesign. It is intended to deploy outside Wix while using the official Wix site as the backend for CMS and Store data.

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
- `WIX_STORES_API_KEY` for store catalog reads and eCommerce checkout creation.
- `WIX_FORMS_API_KEY` for Wix Forms submissions.

If Wix returns checkout URLs on the same domain as the Astro deployment, set
`WIX_CHECKOUT_BASE_URL` to the separate Wix-managed checkout domain so `/checkout`
does not get handled by Astro.

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
Cloudflare Workers. Cache durations are centralized in `src/lib/cache.ts`. Wix store,
events, and CMS reads are memoized in the serverless function process for 60
seconds. Wix CMS reads keep stale successful values for one hour if Wix is
temporarily unavailable, and short-cache failures for 30 seconds so a Wix
timeout does not cause every request to retry immediately. Page content sections
are loaded once per page key and shared by `getPageSection()` calls.

Public cached pages and generated routes send:

```txt
Cache-Control: public, max-age=60, s-maxage=60, stale-while-revalidate=3600
```

Product images are still served by Wix, but the Astro storefront requests smaller
Wix image variants with responsive `srcset` values so the browser does not pull
the original 2000px catalog images for every card.

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
