import type { APIRoute } from "astro";
import { submitWixContactForm } from "../../lib/wix-contact";

function getString(formData: FormData, key: string): string {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

export const POST: APIRoute = async ({ request, redirect }) => {
  const formData = await request.formData();
  const honeypot = getString(formData, "company");

  if (honeypot) {
    return redirect("/contact?status=sent", 303);
  }

  const firstName = getString(formData, "firstName");
  const lastName = getString(formData, "lastName");
  const email = getString(formData, "email");
  const message = getString(formData, "message");

  if (!firstName || !lastName || !email || !message) {
    return redirect("/contact?status=missing", 303);
  }

  try {
    await submitWixContactForm({ firstName, lastName, email, message });
    return redirect("/contact?status=sent", 303);
  } catch (error) {
    console.error("Failed to submit Wix contact form", error);
    return redirect("/contact?status=error", 303);
  }
};
