export function guardRequestPath(url: URL): Response | undefined {
  let pathname: string;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return new Response(null, { status: 400 });
  }
  // This Worker has no PHP routes. Reject probes before Astro matches routes.
  if (/\.(?:php\d?|phtml|phar)(?:\/|$)/i.test(pathname)) {
    return new Response(null, { status: 404 });
  }
}
