// The app's own IBM Plex files, as @font-face rules for a gallery page.
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * The gallery names IBM Plex first in its font stacks but does not load it, so
 * a machine without Plex draws the gallery in a fallback font. The app
 * self-hosts Plex. Load the same font files into the gallery page, so the two
 * screenshots differ only where the pages differ.
 */
export const FONT_FACES = [
  ["IBM Plex Sans", "ibm-plex-sans", [400, 500, 600]],
  ["IBM Plex Mono", "ibm-plex-mono", [400, 500]],
]
  .flatMap(([family, pkg, weights]) =>
    weights.map((weight) => {
      const file = resolve(
        `node_modules/@fontsource/${pkg}/files/${pkg}-latin-${weight}-normal.woff2`,
      );
      return `@font-face { font-family: "${family}"; font-weight: ${weight}; src: url("${pathToFileURL(file).href}") format("woff2"); }`;
    }),
  )
  .join("\n");
