type ContactSubmission = {
  firstName: string;
  lastName: string;
  email: string;
  message: string;
};

function requiredEnv(name: string): string {
  const value = import.meta.env[name];

  if (!value) {
    throw new Error(`${name} is not set.`);
  }

  return value;
}

function contactFieldMap() {
  return {
    firstName: import.meta.env.WIX_CONTACT_FIELD_FIRST_NAME || "first_name",
    lastName: import.meta.env.WIX_CONTACT_FIELD_LAST_NAME || "last_name",
    email: import.meta.env.WIX_CONTACT_FIELD_EMAIL || "email",
    message: import.meta.env.WIX_CONTACT_FIELD_MESSAGE || "message",
  };
}

export async function submitWixContactForm(submission: ContactSubmission) {
  const formId = requiredEnv("WIX_CONTACT_FORM_ID");
  const apiKey = requiredEnv("WIX_API_KEY");
  const siteId = requiredEnv("WIX_SITE_ID");
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

    throw new Error(message);
  }
}
