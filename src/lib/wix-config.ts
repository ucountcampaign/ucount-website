/**
 * Non-secret Wix identifiers. These are stable properties of the official Wix
 * site rather than per-deployment configuration, so they live in code as the
 * single source of truth instead of being duplicated across `.env`,
 * `.env.example`, and the Worker's dashboard variables.
 *
 * `getEnv()` still prefers a runtime or build-time value when one is set, so a
 * staging deployment can point at a different Wix site without a code change.
 *
 * Privileged API keys (WIX_DATA_API_KEY, WIX_EVENTS_API_KEY,
 * WIX_FORMS_API_KEY, SQUARE_ACCESS_TOKEN) are secrets and must never appear
 * here — they stay in `.env` locally and in Worker secrets when deployed.
 */
export const WIX_CONFIG_DEFAULTS: Record<string, string> = {
  WIX_SITE_ID: "a73b0895-820a-424a-8f69-053753fa007c",

  // The modern Wix Forms "Astro Contact Form" schema. The field targets are
  // immutable once the form exists, so a mismatch here silently submits to
  // field keys Wix does not have.
  WIX_CONTACT_FORM_ID: "1a784f54-c174-4349-8d67-7dbf93214af5",
  WIX_CONTACT_FIELD_FIRST_NAME: "first_name_5b78",
  WIX_CONTACT_FIELD_LAST_NAME: "last_name_3ab0",
  WIX_CONTACT_FIELD_EMAIL: "email_df1a",
  WIX_CONTACT_FIELD_MESSAGE: "message",
};
