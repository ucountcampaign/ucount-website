/// <reference types="astro/client" />

// Declare the Cloudflare APIs used here without committing generated types.
declare module "cloudflare:workers" {
  export const env: Record<string, unknown>;
  export function waitUntil(task: Promise<unknown>): void;
}

interface ImportMetaEnv {
  readonly PUBLIC_SITE_URL?: string;
  readonly SITE_URL?: string;
  readonly CF_PAGES_URL?: string;
  readonly WIX_SITE_ID?: string;
  readonly WIX_EVENTS_API_KEY?: string;
  readonly WIX_DATA_API_KEY?: string;
  readonly WIX_STORES_API_KEY?: string;
  readonly WIX_FORMS_API_KEY?: string;
  readonly WIX_CHECKOUT_BASE_URL?: string;
  readonly WIX_CMS_COLLECTION_ALIASES?: string;
  readonly WIX_CONTACT_FORM_ID?: string;
  readonly WIX_CONTACT_FIELD_FIRST_NAME?: string;
  readonly WIX_CONTACT_FIELD_LAST_NAME?: string;
  readonly WIX_CONTACT_FIELD_EMAIL?: string;
  readonly WIX_CONTACT_FIELD_MESSAGE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
