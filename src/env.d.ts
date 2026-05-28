/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly WIX_CLIENT_ID?: string;
  readonly WIX_SITE_ID?: string;
  readonly WIX_API_KEY?: string;
  readonly WIX_CMS_COLLECTION_ALIASES?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
