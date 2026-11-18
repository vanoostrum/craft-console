// Open each page of the running app, check the Projects numbers against the
// fixture totals, and save screenshots of the app and of the gallery page.
// Usage: node drive.mjs <base url> <evidence dir>
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const [base, evidence] = process.argv.slice(2);
const PLATFORMS = {
  desktop: { width: 1280, height: 800 },
  mobile: { width: 390, height: 844 },
};
const PAGES = [
  {
    feature: "projects",
    path: "/",
    gallery: "design/pages/projects/default.html",
  },
  {
    feature: "craft-versions",
    path: "/versions",
    gallery: "design/pages/craft-versions/default.html",
  },
];

/** The rows the fixtures must give: sessions per repo, known tickets per repo, no-repo last. */
function expectedRows() {
  const dir = "src/fixtures/sessions";
  const sessions = readdirSync(dir).map((name) =>
    JSON.parse(readFileSync(join(dir, name), "utf8")),
  );
  const known = new Set(
    JSON.parse(readFileSync("src/fixtures/tickets.json", "utf8")).map(
      (t) => t.key,
    ),
  );
  const groups = new Map();
  for (const s of sessions) {
    const g = groups.get(s.repo) ?? { sessions: 0, tickets: new Set() };
    g.sessions += 1;
    s.tickets.filter((k) => known.has(k)).forEach((k) => g.tickets.add(k));
    groups.set(s.repo, g);
  }
  const rows = [...groups].map(([repo, g]) => [
    repo === "no-repo" ? "No repository" : repo,
    String(g.sessions),
    String(g.tickets.size),
  ]);
  const named = rows
    .filter((r) => r[0] !== "No repository")
    .sort((a, b) => Number(b[1]) - Number(a[1]) || (a[0] < b[0] ? -1 : 1));
  return [...named, ...rows.filter((r) => r[0] === "No repository")];
}

/**
 * The gallery names IBM Plex first in its font stacks but does not load it, so
 * a machine without Plex draws the gallery in a fallback font. The app
 * self-hosts Plex. Load the same font files into the gallery page, so the two
 * screenshots differ only where the pages differ.
 */
const FONT_FACES = [
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

const failures = [];
const browser = await chromium.launch();
try {
  for (const page of PAGES) {
    const dir = join(evidence, page.feature);
    mkdirSync(dir, { recursive: true });
    const log = [];
    for (const [platform, viewport] of Object.entries(PLATFORMS)) {
      const tab = await browser.newPage({ viewport });
      const response = await tab.goto(base + page.path);
      log.push(`GET ${page.path} (${platform}) -> ${response.status()}`);
      if (response.status() !== 200)
        failures.push(`${page.path} answered ${response.status()}`);
      const current = await tab
        .locator('nav[aria-label="Main"] [aria-current="page"]')
        .allTextContents();
      log.push(`current tab: ${JSON.stringify(current)}`);
      const h1 = await tab.locator("h1").innerText();
      log.push(`heading: ${JSON.stringify(h1)}`);
      const scroll = await tab.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      log.push(
        `page-wide horizontal scroll: ${scroll > 0 ? `${scroll}px` : "none"}`,
      );
      if (scroll > 0)
        failures.push(`${page.path} scrolls sideways on ${platform}`);
      if (page.feature === "projects") {
        const rows = await tab
          .locator("tbody tr")
          .evaluateAll((trs) =>
            trs.map((tr) =>
              [...tr.querySelectorAll("td")].map((td) => td.textContent.trim()),
            ),
          );
        const expected = expectedRows();
        log.push(
          `rows: ${JSON.stringify(rows)}`,
          `fixture totals: ${JSON.stringify(expected)}`,
        );
        if (JSON.stringify(rows) !== JSON.stringify(expected))
          failures.push(
            `Projects rows differ from the fixture totals on ${platform}`,
          );
      }
      await tab.screenshot({
        path: join(dir, `app_${page.feature}_${platform}.png`),
        fullPage: true,
      });
      await tab.goto(pathToFileURL(resolve(page.gallery)).href);
      await tab.addStyleTag({ content: FONT_FACES });
      await tab.evaluate(() => document.fonts.ready);
      await tab.screenshot({
        path: join(dir, `gallery_${page.feature}_${platform}.png`),
        fullPage: true,
      });
      await tab.close();
    }
    writeFileSync(join(dir, "transcript.txt"), log.join("\n") + "\n");
    console.log(`== ${page.feature}\n${log.join("\n")}`);
  }
} finally {
  await browser.close();
}
if (failures.length) {
  console.error(`FAIL\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log(`PASS: screenshots in ${evidence}`);
