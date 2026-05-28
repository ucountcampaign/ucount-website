# U COUNT Self-Managed Headless Site

This is the self-managed Astro version of the U COUNT redesign. It is intended to deploy outside Wix while using the official Wix site as the backend for CMS and Store data.

## Setup

```sh
pnpm install
cp .env.example .env
```

Set `WIX_CLIENT_ID` to the Headless client ID from the official Wix site dashboard.

If a CMS collection was created manually and Wix assigned an immutable collection ID
like `Import1`, map the app's expected collection name to that real ID:

```sh
WIX_CMS_COLLECTION_ALIASES='{"SiteSettings":"Import1"}'
```

## Development

```sh
pnpm dev
```

## Build

```sh
pnpm build
```

## Deployment

This project is currently configured for Cloudflare Pages/Workers through `@astrojs/cloudflare`. Add the same environment variables in the deployment platform.

Do not copy `.env.local` or Wix-managed credentials from the old `ucount-headless` project into this repo.
