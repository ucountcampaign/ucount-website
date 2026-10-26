import { defineMiddleware } from "astro:middleware";

export const onRequest = defineMiddleware(({ url }, next) => {
  let pathname: string;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return new Response(null, { status: 400 });
  }
  // This Worker has no PHP routes. Reject probes before dynamic pages read Wix.
  if (/\.(?:php\d?|phtml|phar)(?:\/|$)/i.test(pathname)) {
    return new Response(null, { status: 404 });
  }
  return next();
});
