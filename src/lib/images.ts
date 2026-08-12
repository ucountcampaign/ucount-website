export type WixImageResizeOptions = {
  width: number;
  height: number;
  mode?: "fit" | "fill";
  quality?: number;
};

function wixImageUriToUrl(value: string): string {
  const imageMatch = value.match(/^wix:image:\/\/v1\/([^/#?]+)/i);

  if (imageMatch) {
    return `https://static.wixstatic.com/media/${imageMatch[1]}`;
  }

  // SVG uploads are stored as vector URIs and served from /shapes/, not /media/.
  const vectorMatch = value.match(/^wix:vector:\/\/v1\/([^/#?]+)/i);

  return vectorMatch ? `https://static.wixstatic.com/shapes/${vectorMatch[1]}` : "";
}

export function resolveWixImageUrl(value: unknown, fallback = ""): string {
  if (!value) {
    return fallback;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) {
      return fallback;
    }

    return wixImageUriToUrl(trimmed) || trimmed;
  }

  if (Array.isArray(value)) {
    return value.map((item) => resolveWixImageUrl(item)).find(Boolean) ?? fallback;
  }

  if (typeof value !== "object") {
    return fallback;
  }

  const record = value as Record<string, unknown>;
  const imageData =
    record.imageData && typeof record.imageData === "object"
      ? (record.imageData as Record<string, unknown>)
      : null;
  const image =
    imageData?.image && typeof imageData.image === "object"
      ? (imageData.image as Record<string, unknown>)
      : null;
  const src =
    image?.src && typeof image.src === "object"
      ? (image.src as Record<string, unknown>)
      : null;
  const srcId = typeof src?.id === "string" ? src.id.trim() : "";

  if (srcId && /^[A-Za-z0-9_.~-]+$/.test(srcId)) {
    return `https://static.wixstatic.com/media/${srcId}`;
  }

  const directId = typeof record.id === "string" ? record.id.trim() : "";

  if (directId && /^[A-Za-z0-9_.~-]+$/.test(directId) && /(?:~mv2|\.\w{2,5}$)/i.test(directId)) {
    return `https://static.wixstatic.com/media/${directId}`;
  }

  return [
    "url",
    "fullUrl",
    "src",
    "image",
    "media",
    "file",
    "thumbnail",
    "nodes",
    "children",
  ]
    .map((key) => resolveWixImageUrl(record[key]))
    .find(Boolean) ?? fallback;
}

export function resizeWixImageUrl(
  url: string,
  {
    width,
    height,
    mode = "fit",
    quality = 82,
  }: WixImageResizeOptions,
): string {
  const resolvedUrl = resolveWixImageUrl(url, url);

  try {
    const parsedUrl = new URL(resolvedUrl);

    // Resize transforms only exist for raster files under /media/; applying
    // them to /shapes/ (SVG) URLs returns a 403, and SVGs scale anyway.
    if (
      !parsedUrl.hostname.endsWith("wixstatic.com") ||
      parsedUrl.pathname.startsWith("/shapes/") ||
      /\.svg$/i.test(parsedUrl.pathname)
    ) {
      return resolvedUrl;
    }

    const transform =
      mode === "fill"
        ? `fill/w_${width},h_${height},al_c,q_${quality},enc_auto`
        : `fit/w_${width},h_${height},q_${quality},enc_auto`;

    // The transform chain is delimited by the last /v1/ segment; earlier ones
    // can belong to the media path itself.
    const existingTransformIndex = parsedUrl.pathname.lastIndexOf("/v1/");

    if (existingTransformIndex !== -1) {
      const sourcePath = parsedUrl.pathname.slice(0, existingTransformIndex);
      const existingSegments = parsedUrl.pathname
        .slice(existingTransformIndex + "/v1/".length)
        .split("/");
      const lastSegment = existingSegments.at(-1) ?? "";
      const outputFilename = /\.[a-z0-9]{2,5}$/i.test(lastSegment)
        ? lastSegment
        : "file.jpg";

      // CMS image URLs can include an editor-selected crop before their Wix
      // resize operation (always the first operation after /v1/). Keep that
      // crop while replacing only the output size.
      const cropParams =
        existingSegments[0] === "crop" && existingSegments.length > 2
          ? existingSegments[1]
          : "";
      const crop = cropParams ? `crop/${cropParams}/` : "";

      parsedUrl.pathname = `${sourcePath}/v1/${crop}${transform}/${outputFilename}`;
      return parsedUrl.toString();
    }

    // Keep the source extension so formats with transparency (PNG) are not
    // flattened by a .jpg fallback when enc_auto negotiation is unavailable.
    const sourceExtension =
      parsedUrl.pathname.match(/\.(jpe?g|png|gif|webp|avif)$/i)?.[1] ?? "jpg";

    parsedUrl.pathname = `${parsedUrl.pathname.replace(/\/+$/, "")}/v1/${transform}/file.${sourceExtension.toLowerCase()}`;

    return parsedUrl.toString();
  } catch {
    return resolvedUrl;
  }
}

export function createWixImageSrcSet(
  url: string,
  sizes: Array<{ width: number; height: number }>,
  mode: "fit" | "fill" = "fit",
): string {
  return sizes
    .map((size) => {
      const resized = resizeWixImageUrl(url, { ...size, mode });

      // A missing image resolves to ""; skip it so the srcset does not emit
      // bare "480w" candidates that browsers parse as relative URLs.
      return resized ? `${resized} ${size.width}w` : "";
    })
    .filter(Boolean)
    .join(", ");
}
