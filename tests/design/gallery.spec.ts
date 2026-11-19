import { expect, test } from "@playwright/test";
import { onePrimary, pageChecks, PLATFORMS } from "./checks";
import { GALLERY_PAGES, openGalleryPage } from "./gallery";

// Every gallery page at each platform: contrast, visibility, no page scroll.
// The pages in design/pages/ also have at most one primary action that stands
// out. Component and pattern pages show the primary action in several states.

test("the glob finds the pages, components, and patterns", () => {
  for (const dir of ["pages", "components", "patterns"])
    expect(GALLERY_PAGES.some((p) => p.startsWith(`design/${dir}/`))).toBe(true);
});

for (const path of GALLERY_PAGES)
  for (const platform of PLATFORMS)
    test(`${path} on ${platform.name}`, async ({ page }) => {
      await page.setViewportSize(platform);
      await openGalleryPage(page, path);
      const failures = await pageChecks(page, path);
      if (path.startsWith("design/pages/"))
        failures.push(...(await onePrimary(page, path)));
      expect(failures).toEqual([]);
    });
