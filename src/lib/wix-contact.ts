type ContactSubmission = {
  firstName: string;
  lastName: string;
  email: string;
  message: string;
};

type ContactConfig = {
  apiKey: string;
  formId: string;
  siteId: string;
};

export class ContactFormConfigError extends Error {
  readonly missingVariables: string[];

  constructor(missingVariables: string[]) {
    super(`Contact form is missing required configuration: ${missingVariables.join(", ")}.`);
    this.name = "ContactFormConfigError";
    this.missingVariables = missingVariables;
  }
}

export class WixContactSubmissionError extends Error {
  readonly status: number;
  readonly responseBody: string;

  constructor(status: number, message: string, responseBody: string) {
    super(message);
    this.name = "WixContactSubmissionError";
    this.status = status;
    this.responseBody = responseBody;
  }
}

function envValue(name: string): string {
  const value = import.meta.env[name];

  return typeof value === "string" ? value.trim() : "";
}

function contactFieldMap() {
  return {
    firstName: import.meta.env.WIX_CONTACT_FIELD_FIRST_NAME || "first_name",
    lastName: import.meta.env.WIX_CONTACT_FIELD_LAST_NAME || "last_name",
    email: import.meta.env.WIX_CONTACT_FIELD_EMAIL || "email",
    message: import.meta.env.WIX_CONTACT_FIELD_MESSAGE || "message",
  };
}

function getContactConfig(): ContactConfig {
  const config = {
    apiKey: envValue("WIX_FORMS_API_KEY"),
    formId: envValue("WIX_CONTACT_FORM_ID"),
    siteId: envValue("WIX_SITE_ID"),
  };
  const missingVariables = [
    ["WIX_FORMS_API_KEY", config.apiKey],
    ["WIX_CONTACT_FORM_ID", config.formId],
    ["WIX_SITE_ID", config.siteId],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missingVariables.length > 0) {
    throw new ContactFormConfigError(missingVariables);
  }

  return config;
}

export function isWixContactFormConfigured(): boolean {
  try {
    getContactConfig();
    return true;
  } catch (error) {
    if (error instanceof ContactFormConfigError) {
      return false;
    }

    throw error;
  }
}

export async function submitWixContactForm(submission: ContactSubmission) {
  const { apiKey, formId, siteId } = getContactConfig();
  const fields = contactFieldMap();

  const response = await fetch(
    "https://www.wixapis.com/form-submission-service/v4/submissions",
    {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
        "wix-site-id": siteId,
      },
      body: JSON.stringify({
        submission: {
          formId,
          submissions: {
            [fields.firstName]: submission.firstName,
            [fields.lastName]: submission.lastName,
            [fields.email]: submission.email,
            [fields.message]: submission.message,
          },
        },
      }),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    let message = `Wix contact submission failed with ${response.status}.`;

    try {
      const data = JSON.parse(text) as { message?: string };
      message = data.message || message;
    } catch {
      // Keep the status-based message when Wix returns a non-JSON error body.
    }

    throw new WixContactSubmissionError(response.status, message, text);
  }
}
