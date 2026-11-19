import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { contrast, noPageScroll, onePrimary, visibility } from "./checks";

// No real page or route fails a check, so these synthetic pages prove that
// each check fails, and that its message names the page, the width, the
// element, and the measured values.

const DARK = "body { margin: 0; background: #0f1115; color: #e6e8ec; font: 13px sans-serif; }";

async function synthetic(page: Page, width: number, css: string, body: string) {
  await page.setViewportSize({ width, height: 800 });
  await page.setContent(
    `<!doctype html><html lang="en"><head><title>synthetic</title><style>${DARK} ${css}</style></head><body>${body}</body></html>`,
  );
}

test("a page that scrolls sideways fails", async ({ page }) => {
  await synthetic(page, 1280, ".wide { width: 2000px; }", `<div class="wide">A wide row</div>`);
  expect(await noPageScroll(page, "synthetic wide page")).toEqual([
    "synthetic wide page at 1280px: the page scrolls sideways: scrollWidth 2000px > 1280px",
  ]);
});

test("text over a gradient fails, and names the element and axe's reason", async ({ page }) => {
  await synthetic(
    page,
    1280,
    ".band { background: linear-gradient(90deg, #0f1115, #7fb0ff); padding: 12px; }",
    `<p class="band">Text over a gradient</p>`,
  );
  const failures = await contrast(page, "synthetic gradient");
  expect(failures).toHaveLength(1);
  expect(failures[0]).toMatch(
    /^synthetic gradient at 1280px: p: contrast not judged: .*background gradient/,
  );
});

const PANEL = `
  .panel { width: 600px; max-width: 100%; overflow-x: auto; border: 1px solid #262a33; }
  table { width: 1600px; table-layout: fixed; border-collapse: collapse; }
  td { padding: 8px; }
`;
// The far cell sits beyond the panel's right edge and beyond the window, as
// the grid's last cells do at the phone width: axe cannot see its background.
const PANEL_BODY = `<div class="panel"><table><tr><td style="width: 1100px">Ticket</td><td style="width: 200px">€26.10</td><td class="far">€30.30</td></tr></table></div>`;

test("a cell beyond the edge of a .panel at 1280 fails", async ({ page }) => {
  await synthetic(page, 1280, PANEL, PANEL_BODY);
  const failures = await contrast(page, "synthetic panel");
  expect(failures).toHaveLength(1);
  expect(failures[0]).toMatch(/^synthetic panel at 1280px: \.far: contrast not judged: /);
});

test("the same cell at the phone width is skipped, as case (a) says", async ({ page }) => {
  await synthetic(page, 390, PANEL, PANEL_BODY);
  const results = await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze();
  // axe gives the cell as incomplete, and the check skips it.
  expect(results.incomplete.flatMap((v) => v.nodes).map((n) => n.target.join(" "))).toContain(".far");
  expect(await contrast(page, "synthetic panel")).toEqual([]);
});

test("text below AA fails with its ratio and colours", async ({ page }) => {
  await synthetic(page, 1280, ".dim { color: #4a505c; }", `<p class="dim">Dim text</p>`);
  expect(await contrast(page, "synthetic dim")).toEqual([
    "synthetic dim at 1280px: p: contrast 2.33:1 (#4a505c on #0f1115), needs 4.5:1",
  ]);
});

test("text cut by an overflow: hidden ancestor, and a link of zero size, fail", async ({ page }) => {
  await synthetic(
    page,
    1280,
    ".clip { width: 40px; overflow: hidden; white-space: nowrap; } .clip span { display: inline-block; } .none { display: inline-block; width: 0; height: 0; overflow: hidden; }",
    `<div class="clip"><span>A long label that is cut</span></div><a class="none" href="#">Hidden link</a>`,
  );
  const failures = await visibility(page, "synthetic clip");
  expect(failures).toHaveLength(2);
  expect(failures[0]).toMatch(
    /^synthetic clip at 1280px: span "A long label that is cut": cut by div\.clip "A long label that is cut": box 0,0 \d+×15 outside 0,0 40×15$/,
  );
  expect(failures[1]).toBe('synthetic clip at 1280px: a.none "Hidden link": box 0×0');
});

test("text with opacity 0 or visibility hidden fails, and text under [hidden] is not checked", async ({
  page,
}) => {
  await synthetic(
    page,
    1280,
    ".ghost { opacity: 0; } .gone { visibility: hidden; }",
    `<div class="ghost"><p>Faded</p></div><p class="gone">Gone</p><table><tr hidden><td>Folded row</td></tr></table>`,
  );
  expect(await visibility(page, "synthetic ghost")).toEqual([
    'synthetic ghost at 1280px: p "Faded": opacity 0 on div.ghost "Faded"',
    'synthetic ghost at 1280px: p.gone "Gone": visibility hidden',
  ]);
});

const ACCENT = ":root { --accent: #7fb0ff; } .primary { background: var(--accent); color: #0f1115; padding: 6px 12px; }";

test("two primary actions fail", async ({ page }) => {
  await synthetic(page, 1280, ACCENT, `<a class="primary" href="#">One</a> <a class="primary" href="#">Two</a>`);
  expect(await onePrimary(page, "synthetic two")).toEqual([
    'synthetic two at 1280px: 2 primary actions: "One", "Two"',
  ]);
});

test("a primary action that does not stand out fails", async ({ page }) => {
  await synthetic(
    page,
    1280,
    `${ACCENT} .flat { background: #14171d; color: #4a505c; } .badge { background: var(--accent); display: inline-block; width: 8px; height: 8px; }`,
    `<a class="primary flat" href="#">Flat</a> <span class="badge"></span>`,
  );
  expect(await onePrimary(page, "synthetic flat")).toEqual([
    'synthetic flat at 1280px: .primary "Flat": fill #14171d on #0f1115 is 1.05:1, needs 3:1',
    'synthetic flat at 1280px: .primary "Flat": label #4a505c on #14171d is 2.22:1, needs 4.5:1',
    'synthetic flat at 1280px: .primary "Flat" does not stand out: span.badge has the accent rgb(127, 176, 255) as its background too',
  ]);
});
