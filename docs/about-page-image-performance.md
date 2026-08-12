# About page image performance

## Summary

The About page team portraits were slow on a cold visit because it rendered the
original Wix CMS files. Browser caching was already working, but it could only
help after the first download.

The six portrait URLs transferred about 15.4 MiB before this change. One source
file accounted for about 13.7 MiB and another accounted for about 1.4 MiB.
The six 800 pixel variants transfer about 697 KiB in total, which is about 95.6%
less data than the original URLs.

## Implementation

Each portrait now uses Wix's image service to produce 480, 800, and 1200 pixel
responsive variants. The browser selects a variant from `srcset` based on the
card width and device pixel ratio. Existing Wix editor crops remain part of the
transformed URL, so the optimization does not discard the selected framing.

The images remain lazy loaded because the team section is below the fold. The
About page also opens an early connection to `static.wixstatic.com`, which
removes connection setup time when the browser approaches the team section.

## Why the images are not preloaded

Preloading every portrait would start all image downloads during the initial
render. That would compete with fonts, styles, and above-the-fold resources.
Preloading changes download priority, but it does not reduce the bytes sent.

This follows the useful part of the behavior commonly associated with image
components in frameworks such as Next.js: serve correctly sized responsive
images first, then rely on normal HTTP caching for repeat visits.

## Cache behavior

Wix serves these image variants with a 30-day, immutable browser cache. A cold
visit still needs to download the selected variants, while later visits can
reuse the browser cache. The transformed URL changes when its dimensions or
quality settings change, so immutable caching is safe.

## Verification

For a performance check:

1. Open the About page in a private browser window.
2. Open the browser network panel and disable its local cache.
3. Filter requests by `static.wixstatic.com`.
4. Scroll to the Directional Team section.
5. Confirm that the selected portrait URLs contain `/v1/fit/` and that the
   browser selects a 480, 800, or 1200 pixel candidate.
6. Reload without disabling the cache and confirm that Wix serves the same URLs
   from browser cache.

Keep the portraits lazy loaded unless the page layout moves them above the
fold. If that happens, preload only the image that becomes the page's primary
visual and ensure its preload attributes match its `srcset` and `sizes` values.
