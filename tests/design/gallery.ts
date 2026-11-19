// The gallery pages, found with a glob, and how to open one from file://
// with the app's own IBM Plex fonts.
import { globSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { Page } from "@playwright/test";

/** Every gallery page, as a path from the repository root. A new page is checked with no change here. */
export const GALLERY_PAGES = globSync(
  "design/{pages,components,patterns}/**/*.html",
).sort();

/**
 * The gallery names IBM Plex but does not load it. Load the app's own Plex
 * files, as `.claude/skills/verify/scripts/fonts.mjs` does for screenshots, so
 * contrast and boxes are measured in the same font as the app.
 */
const FONT_FACES = (
  [
    ["IBM Plex Sans", "ibm-plex-sans", [400, 500, 600]],
    ["IBM Plex Mono", "ibm-plex-mono", [400, 500]],
  ] as const
)
  .flatMap(([family, pkg, weights]) =>
    weights.map((weight) => {
      const file = resolve(
        `node_modules/@fontsource/${pkg}/files/${pkg}-latin-${weight}-normal.woff2`,
      );
      return `@font-face { font-family: "${family}"; font-weight: ${weight}; src: url("${pathToFileURL(file).href}") format("woff2"); }`;
    }),
  )
  .join("\n");

export async function openGalleryPage(page: Page, path: string) {
  await page.goto(pathToFileURL(resolve(path)).href);
  await page.addStyleTag({ content: FONT_FACES });
  await page.evaluate(() => document.fonts.ready);
}
