import { getSiteSettings, getPageSection } from "../../src/lib/wix-cms.ts";
import { getFeaturedStoreProducts, getStorefrontProducts, getStoreProductBySlug } from "../../src/lib/wix-store.ts";
import { getEvents, getEventBySlug } from "../../src/lib/wix-events.ts";
import { createWixReadCache, wixUnavailableResponse } from "../../src/lib/wix-read-cache.ts";
import { GET as sitemap } from "../../src/pages/sitemap.xml.ts";
import { GET as fullFeed } from "../../src/pages/llms-full.txt.ts";
import { guardRequestPath } from "../../src/lib/request-guard.ts";
import { POST as contact } from "../../src/pages/api/contact.ts";
import { POST as checkout } from "../../src/pages/api/checkout.ts";
const read = createWixReadCache();
let cmsDelay = 0;
let productDelay = 0;
let eventDeleted = false;
let eventDelay = 0, malformedEvents = false, truncatedProducts = false, failedCollections = false;
let cmsTitle = "Verified CMS title";
let clockOffset = 0;
const nativeNow = Date.now;
Date.now = () => nativeNow() + clockOffset;
const calls: Record<string, number> = {};
globalThis.fetch = async (input, init) => {
  const request = new Request(input, init);
  const url = new URL(request.url);
  if (url.hostname !== "www.wixapis.com") throw new Error("Fixture forbids external requests");
  calls[url.pathname] = (calls[url.pathname] ?? 0) + 1;
  if (url.pathname.includes("/submissions")) return Response.json({ submission: { id: "fixture" } });
  if (url.pathname === "/ecom/v1/checkouts") return Response.json({ checkout: { checkoutUrl: "https://ucountcampaign.org/checkout?checkoutId=fixture" } });
  if (url.pathname.includes("items/query")) {
    if (cmsDelay) await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, cmsDelay);
      request.signal.addEventListener("abort", () => { clearTimeout(timer); reject(request.signal.reason); }, { once: true });
    });
    return Response.json({dataItems: [{id:"fixture", data:{siteName: "Primary Wix fixture", pageKey:"home", sectionKey:"hero", isPublished:true, title:cmsTitle}}], pagingMetadata:{count:1,total:1,offset:0}});
  }
  if (url.pathname.includes("products/query")) {
    if (productDelay) await new Promise(resolve => setTimeout(resolve, productDelay));
    return Response.json({products:truncatedProducts ? [] : [{id:"fixture-product",name:"Fixture product",slug:"fixture-product",collectionIds:["fixture-collection"],visible:true,stock:{inStock:true},price:{price:12,currency:"USD"},media:{mainMedia:{image:{url:"https://static.wixstatic.com/media/fixture.jpg"}}}}],metadata:{count:truncatedProducts?0:1,offset:0,total:1}});
  }
  if (url.pathname.includes("collections/query")) return failedCollections ? Response.json({message:"unavailable"},{status:500}) : Response.json({collections:[{id:"fixture-collection",name:"Fixture category",slug:"fixture-category"}],metadata:{count:1,offset:0,total:1}});
  if (url.pathname.includes("events")) {
    if (eventDelay) await new Promise(resolve => setTimeout(resolve, eventDelay));
    if (malformedEvents) return Response.json({events:{}});
    const body = await request.json() as { query?: { filter?: { slug?: unknown } } };
    const events = body.query?.filter?.slug && !eventDeleted ? [{ id: "fixture-event", slug: "fixture-event", title: "Fixture event", status: "UPCOMING", dateAndTimeSettings: { startDate: "2027-01-01T12:00:00Z" } }] : [];
    return Response.json({events});
  }
  throw new Error("Unhandled fixture API " + url.pathname);
};
export default {
  async fetch(request: Request) {
    const url = new URL(request.url);
    if (url.pathname === "/api/contact" || url.pathname === "/api/checkout") {
      const handler = url.pathname === "/api/contact" ? contact : checkout;
      return handler({ request, redirect: (location, status) => new Response(null, {status, headers: {Location: location}}) } as Parameters<typeof handler>[0]);
    }
    if (url.pathname === "/configure") { cmsDelay = Number(url.searchParams.get("delay") || 0); productDelay = Number(url.searchParams.get("productDelay") || 0); eventDelay = Number(url.searchParams.get("eventDelay") || 0); malformedEvents = url.searchParams.has("malformedEvents"); truncatedProducts = url.searchParams.has("truncatedProducts"); failedCollections = url.searchParams.has("failedCollections"); eventDeleted = url.searchParams.get("eventDeleted") === "true"; cmsTitle = url.searchParams.get("title") || cmsTitle; clockOffset += Number(url.searchParams.get("advance") || 0); return Response.json({cmsDelay,cmsTitle,clockOffset}); }
    if (url.pathname === "/sitemap.xml" || url.pathname === "/llms-full.txt") {
      const handler = url.pathname === "/sitemap.xml" ? sitemap : fullFeed;
      return handler({ url } as Parameters<typeof handler>[0]);
    }
    if (url.pathname === "/product") {
      return getStoreProductBySlug("fixture-product").then(Response.json).catch(wixUnavailableResponse);
    }
    if (url.pathname === "/event") return getEventBySlug(url.searchParams.get("slug") || "fixture-event").then(Response.json).catch(wixUnavailableResponse);
    if (url.pathname === "/stats") return Response.json(calls);
    if (url.pathname === "/cms") {
      const started = Date.now();
      const [settings, section] = await Promise.all([getSiteSettings(), getPageSection("home", "hero")]);
      return Response.json({elapsed: Date.now()-started, settings, section});
    }
    if (url.pathname === "/catalog") {
      const [home, shop, events] = await Promise.all([getFeaturedStoreProducts(), getStorefrontProducts(), getEvents()]);
      return Response.json({home,shop,events,calls});
    }
    if (url.pathname === "/slow") {
      const key = url.searchParams.get("key") || "slow";
      const started = Date.now();
      const value = await read(key, async () => { await new Promise(resolve => setTimeout(resolve, 5000)); return "late primary source"; }).catch(() => "page fallback");
      return Response.json({value,elapsed: Date.now()-started});
    }
    return guardRequestPath(url) ?? Response.json({next:true,calls});
  }
};
