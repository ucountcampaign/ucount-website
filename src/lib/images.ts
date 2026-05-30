export type WixImageResizeOptions = {
  width: number;
  height: number;
  mode?: "fit" | "fill";
  quality?: number;
};

export function resizeWixImageUrl(
  url: string,
  {
    width,
    height,
    mode = "fit",
    quality = 82,
  }: WixImageResizeOptions,
): string {
  try {
    const parsedUrl = new URL(url);

    if (!parsedUrl.hostname.endsWith("wixstatic.com")) {
      return url;
    }

    const transform =
      mode === "fill"
        ? `fill/w_${width},h_${height},al_c,q_${quality},enc_auto`
        : `fit/w_${width},h_${height},q_${quality},enc_auto`;

    if (/\/v1\/[^?]+\/file\.[^/?#]+$/i.test(parsedUrl.pathname)) {
      parsedUrl.pathname = parsedUrl.pathname.replace(
        /\/v1\/[^?]+\/(file\.[^/?#]+)$/i,
        `/v1/${transform}/$1`,
      );
      return parsedUrl.toString();
    }

    parsedUrl.pathname = `${parsedUrl.pathname.replace(/\/+$/, "")}/v1/${transform}/file.jpg`;

    return parsedUrl.toString();
  } catch {
    return url;
  }
}

export function createWixImageSrcSet(
  url: string,
  sizes: Array<{ width: number; height: number }>,
  mode: "fit" | "fill" = "fit",
): string {
  return sizes
    .map((size) => `${resizeWixImageUrl(url, { ...size, mode })} ${size.width}w`)
    .join(", ");
}
