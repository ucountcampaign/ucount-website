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
marketplace and product pages render server-side. Wix store reads are memoized in
the Worker process for five minutes. Wix CMS reads are also memoized in the
Worker process for five minutes, keep stale successful values for one hour if
Wix is temporarily unavailable, and short-cache failures for 30 seconds so a Wix
timeout does not cause every request to retry immediately. Page content sections
are loaded once per page key and shared by `getPageSection()` calls.

The storefront pages send:

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
