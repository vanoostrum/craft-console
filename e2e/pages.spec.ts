import { expect, test, type Page } from "@playwright/test";

const BUCKET =
  "https://console.cloud.google.com/storage/browser/craft-transcripts";

async function expectTopBar(
  page: Page,
  current: "Projects" | "Craft versions",
) {
  await expect(page.locator("header .logo")).toHaveText("craft://console");
  const tabs = page.getByRole("navigation", { name: "Main" });
  await expect(tabs.getByRole("link", { name: "Projects" })).toHaveAttribute(
    "href",
    "/",
  );
  await expect(
    tabs.getByRole("link", { name: "Craft versions" }),
  ).toHaveAttribute("href", "/versions");
  await expect(tabs.locator('[aria-current="page"]')).toHaveCount(1);
  await expect(tabs.locator('[aria-current="page"]')).toHaveText(current);
}

async function expectNoPageScroll(page: Page) {
  const widths = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client);
}

const COLUMNS = [
  "Project",
  "Tickets",
  "Cost",
  "Avg cost",
  "Craft time",
  "Avg time",
  "Waiting on you",
  "Max share · Nov",
];

/** The fixture rows, written by hand from `src/fixtures/` at the price table, with CONSOLE_NOW in November 2026. */
const ROWS = [
  {
    name: "NapTime",
    repo: "vanoostrum/nap-time",
    sessions: "15",
    cells: ["12", "€41.18 *", "€3.43", "5h22m", "27m", "64h", "≈ €61"],
    cost: "plan 8%, spec 34%, design 4%, build 14%, review 24%, merge 3%, other 13%",
    time: "plan 6%, spec 30%, design 4%, build 25%, review 26%, merge 2%, other 8%",
  },
  {
    name: "Craft",
    repo: "vanoostrum/craft",
    sessions: "4",
    cells: ["3", "€12.37", "€4.12", "—", "—", "—", "≈ €21"],
    cost: "spec 69%, build 11%, review 20%",
    time: "no craft time",
  },
  {
    name: "NapTime",
    repo: "vanoostrum/nap-docs",
    sessions: "1",
    cells: ["1", "€0.41", "€0.41", "35m", "35m", "40m", "≈ €1"],
    cost: "spec 50%, build 50%",
    time: "spec 43%, build 57%",
  },
  {
    name: "NapTime",
    repo: "vanoostrum/nap-web",
    sessions: "1",
    cells: ["2", "€0.41", "€0.21", "35m", "18m", "40m", "≈ €1"],
    cost: "spec 50%, build 50%",
    time: "spec 43%, build 57%",
  },
  {
    name: "vanoostrum/sandbox",
    repo: "vanoostrum/sandbox",
    sessions: "1",
    cells: ["1", "€0.00", "€0.00", "25m", "25m", "20m", "—"],
    cost: "no cost",
    time: "spec 100%",
  },
  {
    name: "No repository",
    repo: null,
    sessions: "2",
    cells: ["0", "€5.51", "—", "18m", "—", "3h20m", "≈ €9"],
    cost: "other 100%",
    time: "other 100%",
  },
];

const PHASE_NAMES = [
  "plan",
  "spec",
  "design",
  "build",
  "review",
  "merge",
  "other",
];

async function expectShade(page: Page, shade: "cost" | "time") {
  const label = shade === "cost" ? "cost" : "craft time";
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    `Projects / cost at API list prices, craft working time · phase mix by ${label}`,
  );
  await expect(page.getByRole("columnheader")).toHaveText([
    ...COLUMNS,
    `Phase mix · ${label}`,
  ]);
  const toggle = page.getByRole("group", { name: "Shade by" });
  await expect(toggle.getByRole("link")).toHaveText(["€ cost", "craft time"]);
  await expect(toggle.locator('[aria-current="true"]')).toHaveCount(1);
  await expect(toggle.locator('[aria-current="true"]')).toHaveText(
    shade === "cost" ? "€ cost" : "craft time",
  );
  const rows = page.locator("tbody tr");
  await expect(rows).toHaveCount(ROWS.length);
  for (const [index, row] of ROWS.entries()) {
    const tr = rows.nth(index);
    const title = shade === "cost" ? row.cost : row.time;
    await expect(tr.locator(".mix")).toHaveAttribute("title", title);
    const parts = tr.locator(".mix span");
    if (title.startsWith("no ")) await expect(parts).toHaveCount(0);
    else {
      const widths = await parts.evaluateAll((spans) =>
        spans.map((span) => (span as HTMLElement).style.width),
      );
      expect(widths.length).toBe(title.split(", ").length);
      for (const width of widths) expect(width).toMatch(/^\d+(\.\d+)?%$/);
      const total = widths.reduce((sum, w) => sum + parseFloat(w), 0);
      expect(total).toBeCloseTo(100, 2);
    }
  }
}

test.describe("Projects", () => {
  test("shows the top bar, the heading, the columns, the legend, and the notes", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveTitle("Projects · Craft Console");
    await expectTopBar(page, "Projects");
    const bucket = page.getByRole("link", { name: "Open the bucket" });
    await expect(bucket).toHaveAttribute("href", BUCKET);
    await expect(bucket).not.toHaveAttribute("target", /.+/);
    await expect(page.locator(".read-at")).toHaveText(/^Read at \d\d:\d\d$/);
    await expectShade(page, "cost");
    await expect(page.locator(".legend span")).toHaveText(PHASE_NAMES);
    await expect(page.locator(".legend i")).toHaveClass(
      PHASE_NAMES.map((phase) => `p-${phase}`),
    );
    await expect(page.locator("p.note")).toHaveText([
      "* Some cost is missing: claude-opus-6 is not in the price table. Its tokens are left out of the cost.",
      "Max share: your €93 Max plan for November, split over the projects by their cost this month. An estimate: it assumes all Max use is craft.",
    ]);
    await expect(page.locator("tr.raised, tr[aria-current]")).toHaveCount(0);
  });

  test("lists one row per project, sorted by cost, with No repository last", async ({
    page,
  }) => {
    await page.goto("/");
    const rows = page.locator("tbody tr");
    await expect(rows).toHaveCount(ROWS.length);
    for (const [index, row] of ROWS.entries()) {
      const tr = rows.nth(index);
      const cells = (await tr.locator("td").allTextContents()).map((text) =>
        text.trim(),
      );
      expect(cells.slice(1)).toEqual([...row.cells, ""]);
      const name = tr.locator("td.name");
      await expect(name.locator(".repo")).toHaveCount(row.repo ? 1 : 0);
      if (row.repo) await expect(name.locator(".repo")).toHaveText(row.repo);
      await expect(name).toHaveText(row.name + (row.repo ?? ""));
      await expect(name.locator("a")).toHaveCount(0);
      await expect(tr).toHaveAttribute("data-sessions", row.sessions);
    }
  });

  test("the Shade by switch shades the phase mix by craft time and back", async ({
    page,
  }) => {
    await page.goto("/");
    const toggle = page.getByRole("group", { name: "Shade by" });
    await toggle.getByRole("link", { name: "craft time" }).click();
    await expect(page).toHaveURL(/\/\?shade=time$/);
    await expectShade(page, "time");
    await page.reload();
    await expectShade(page, "time");
    const rows = page.locator("tbody tr");
    for (const [index, row] of ROWS.entries())
      expect(
        (await rows.nth(index).locator("td").allTextContents())
          .slice(1, 8)
          .map((text) => text.trim()),
      ).toEqual(row.cells);
    await toggle.getByRole("link", { name: "€ cost" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expectShade(page, "cost");
  });

  for (const query of [
    "?shade=TIME",
    "?shade=",
    "?shade=cost",
    "?shade=x&shade=time",
  ])
    test(`${query} shades by cost`, async ({ page }) => {
      await page.goto(`/${query}`);
      await expectShade(page, "cost");
    });

  test("a repeated shade parameter uses its first value", async ({ page }) => {
    await page.goto("/?shade=time&shade=cost");
    await expectShade(page, "time");
  });
});

test("Craft versions shows the placeholder and links back to Projects", async ({
  page,
}) => {
  await page.goto("/versions");
  await expect(page).toHaveTitle("Craft versions · Craft Console");
  await expectTopBar(page, "Craft versions");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Craft versions",
  );
  await expect(
    page.getByText(
      "The average cost and craft time per phase, by craft version, comes with Craft Console v1.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Back to Projects" }),
  ).toHaveAttribute("href", "/");
});

test("the tabs move between the pages", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Craft versions" }).click();
  await expect(page).toHaveURL(/\/versions$/);
  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Projects" })
    .click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("tbody tr")).toHaveCount(ROWS.length);
});

for (const [name, path] of [
  ["projects", "/"],
  ["craft-versions", "/versions"],
] as const) {
  for (const [platform, viewport] of [
    ["desktop", { width: 1280, height: 800 }],
    ["mobile", { width: 390, height: 844 }],
  ] as const) {
    test(`${name} fits the ${platform} width with no page scroll`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto(path);
      await expect(page.locator("header .logo")).toBeVisible();
      await expect(page.locator("main")).toBeVisible();
      await expectNoPageScroll(page);
      if (name === "projects") {
        const panel = page.locator(".panel");
        const overflow = await panel.evaluate(
          (el) => el.scrollWidth - el.clientWidth,
        );
        if (platform === "mobile") expect(overflow).toBeGreaterThan(0);
        else expect(overflow).toBe(0);
      }
      await page.screenshot({
        path: `screenshots/${name}_${platform}.png`,
        fullPage: true,
      });
    });
  }
}
