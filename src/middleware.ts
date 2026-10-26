import { defineMiddleware } from "astro:middleware";

// Astro looks up a form action from the `_action` query parameter on POST. It
// decodes each dot-separated part with decodeURIComponent() and does not catch
// the error, so a scanner request like `POST /?_action=%25c0` returns 500 with
// "URIError: URI malformed". Astro 6.4.8 and 7.4.2 both do this. Site
// middleware runs before the action lookup, so reject those requests here.
// Remove this file when Astro guards the decode.
export const onRequest = defineMiddleware((context, next) => {
  const actionName = context.url.searchParams.get("_action");
  if (context.request.method === "POST" && actionName && !canDecodeActionName(actionName)) {
    return new Response("Bad Request", { status: 400 });
  }
  return next();
});

function canDecodeActionName(name: string): boolean {
  try {
    name.split(".").forEach((key) => decodeURIComponent(key));
    return true;
  } catch {
    return false;
  }
}
