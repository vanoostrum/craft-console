import { expect, test, type Page } from "@playwright/test";
import { onePrimary, pageChecks, PLATFORMS } from "./checks";

// The app's HTML routes on fixtures, at each platform: contrast, visibility,
// no page scroll, and at most one primary action that stands out.

const ROUTES = [
  "/",
  "/?shade=time",
  "/projects/vanoostrum/nap-time",
  "/projects/vanoostrum/nap-time?shade=time",
  "/projects/vanoostrum/craft",
  "/projects/vanoostrum/sandbox",
  "/projects/no-repo",
  "/projects/vanoostrum/unknown",
  "/versions",
  "/versions?shade=time",
];

async function allChecks(page: Page, where: string) {
  return [...(await pageChecks(page, where)), ...(await onePrimary(page, where))];
}

for (const route of ROUTES)
  for (const platform of PLATFORMS)
    test(`${route} on ${platform.name}`, async ({ page }) => {
      await page.setViewportSize(platform);
      const response = await page.goto(route);
      expect(response!.status()).toBe(route.endsWith("/unknown") ? 404 : 200);
      expect(await allChecks(page, route)).toEqual([]);
    });

test("the pages without a primary action have none", async ({ page }) => {
  for (const route of ["/projects/no-repo", "/projects/vanoostrum/sandbox"]) {
    await page.goto(route);
    await expect(page.locator(".primary")).toHaveCount(0);
  }
});

/** The solid shade steps of design/components/grid.html. */
const STEPS: Record<string, string> = {
  c1: "rgb(22, 34, 56)",
  c2: "rgb(26, 45, 79)",
  c3: "rgb(31, 58, 104)",
  c4: "rgb(36, 71, 130)",
  c5: "rgb(42, 85, 156)",
};
const SHADED =
  ".grid tr:is(.in-plan, .in-milestone) td.cell:is(.c1, .c2, .c3, .c4, .c5)";
const STRONG = "rgb(255, 255, 255)";
const TEXT = "rgb(230, 232, 236)";
const FAINT = "rgb(139, 146, 160)";

/**
 * Each shaded cell's colours, and the "·" colours, that differ from the
 * gallery. Shaded cells are those of the ticket rows: the "No ticket" row is a
 * group row, and in the gallery and the app a group row keeps its raised
 * background over the shade step.
 */
async function shadeFailures(page: Page, where: string): Promise<string[]> {
  const cells = await page.locator(SHADED).evaluateAll((tds) =>
    tds.map((td) => {
      const step = [...td.classList].find((c) => /^c[1-5]$/.test(c))!;
      const lines = td.querySelectorAll("div");
      return {
        step,
        text: td.textContent!.trim(),
        background: getComputedStyle(td).backgroundColor,
        first: getComputedStyle(lines[0] ?? td).color,
        second: lines[1] ? getComputedStyle(lines[1]).color : null,
      };
    }),
  );
  const dots = await page.locator(".grid td.empty").evaluateAll((tds) =>
    tds.map((td) => getComputedStyle(td).color),
  );
  const failures: string[] = [];
  for (const cell of cells) {
    const at = `${where}: td.cell.${cell.step} "${cell.text}"`;
    if (cell.background !== STEPS[cell.step])
      failures.push(`${at}: background ${cell.background}, needs ${STEPS[cell.step]}`);
    if (cell.first !== STRONG) failures.push(`${at}: text ${cell.first}, needs ${STRONG}`);
    if (cell.second !== null && cell.second !== TEXT)
      failures.push(`${at}: second line ${cell.second}, needs ${TEXT}`);
  }
  for (const dot of new Set(dots))
    if (dot !== FAINT) failures.push(`${where}: td.empty "·": colour ${dot}, needs ${FAINT}`);
  return failures;
}

for (const route of [
  "/projects/vanoostrum/nap-time",
  "/projects/vanoostrum/nap-time?shade=time",
])
  for (const platform of PLATFORMS)
    test(`${route} on ${platform.name}: each shaded cell has its solid step, white text, and a second line in --text; the "·" is --faint`, async ({
      page,
    }) => {
      await page.setViewportSize(platform);
      await page.goto(route);
      const steps = await page
        .locator(SHADED)
        .evaluateAll((tds) =>
          [...new Set(tds.map((td) => td.className))].sort(),
        );
      // Step 5 is the step that failed AA before stage 2, by cost and by time.
      expect(steps).toContain("cell c5");
      expect(steps.length).toBeGreaterThanOrEqual(4);
      await expect(page.locator(".grid td.empty").first()).toBeAttached();
      expect(
        await shadeFailures(page, `${route} at ${platform.width}px`),
      ).toEqual([]);
    });

test("a folded group hides its rows from the checks, and its rows pass again once open", async ({
  page,
}) => {
  const route = "/projects/vanoostrum/nap-time";
  await page.setViewportSize(PLATFORMS[0]);
  await page.goto(route);
  const fold = page.locator("tr.group button.fold").first();
  await expect(fold).toHaveAttribute("aria-expanded", "true");
  await fold.click();
  await expect(fold).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator(".grid tr[hidden]").first()).toBeAttached();
  expect(await allChecks(page, `${route} folded`)).toEqual([]);
  await fold.click();
  await expect(fold).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(".grid tr[hidden]")).toHaveCount(0);
  expect(await allChecks(page, `${route} open again`)).toEqual([]);
});

/** The focus outline of design/components/links.html, primary-action.html, and shade-switch.html. */
for (const route of ["/", "/projects/vanoostrum/nap-time", "/versions"])
  for (const platform of PLATFORMS)
  test(`${route} on ${platform.name}: each link and button shows the accent focus outline from the keyboard`, async ({
    page,
  }) => {
    await page.setViewportSize(platform);
    await page.goto(route);
    const count = await page.locator("a, button").count();
    const seen: string[] = [];
    const failures: string[] = [];
    for (let i = 0; i < count; i++) {
      await page.keyboard.press("Tab");
      const focus = await page.evaluate(() => {
        const el = document.activeElement!;
        const s = getComputedStyle(el);
        const probe = document.createElement("div");
        probe.style.color = "var(--accent)";
        document.body.append(probe);
        const accent = getComputedStyle(probe).color;
        probe.remove();
        return {
          name: `${el.tagName.toLowerCase()}${el.className ? "." + el.className.replace(/ /g, ".") : ""} "${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 30)}"`,
          tag: el.tagName,
          inToggle: !!el.closest(".toggle"),
          outline: `${s.outlineStyle} ${s.outlineWidth} ${s.outlineColor}`,
          offset: s.outlineOffset,
          radius: s.borderTopLeftRadius,
          accent,
        };
      });
      if (focus.tag === "BODY") break;
      seen.push(focus.name);
      const at = `${route} at ${platform.width}px: ${focus.name}`;
      if (focus.outline !== `solid 2px ${focus.accent}`)
        failures.push(`${at}: outline ${focus.outline}, needs solid 2px ${focus.accent}`);
      const offset = focus.inToggle ? "-2px" : "2px";
      if (focus.offset !== offset)
        failures.push(`${at}: outline offset ${focus.offset}, needs ${offset}`);
      if (focus.radius !== "2px")
        failures.push(`${at}: radius ${focus.radius}, needs 2px`);
    }
    expect(seen.length).toBeGreaterThan(3);
    expect(seen.some((s) => s.includes("€ cost"))).toBe(true);
    expect(failures).toEqual([]);
  });
