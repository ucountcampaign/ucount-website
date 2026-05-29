/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly WIX_CLIENT_ID?: string;
  readonly WIX_SITE_ID?: string;
  readonly WIX_API_KEY?: string;
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
