import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * The project pages on the fixtures, with CONSOLE_NOW=2026-11-22T12:00:00Z.
 * Expected values are written by hand from `src/fixtures/` and the price table.
 */

const COLUMNS = [
  "Ticket",
  "plan",
  "spec",
  "design",
  "build",
  "review",
  "merge",
  "other",
  "cost",
  "craft time",
  "waiting on you",
];

const NOTE =
  'A plan holds its plan ticket, with the brainstorm and setup sessions of its brief, and its tickets by milestone. "No ticket" is work that names no ticket, such as a craft:next run on its own, and brief sessions whose plan does not exist yet.';
const MISSING =
  "* Some cost is missing: claude-opus-6 is not in the price table. Its tokens are left out of the cost.";

/** A row: its class, its first cell, the 7 phase cells (cost, time, and the cost shade step), and the 3 totals. */
type Row = [string, string, string[], string[]];

const NAP_TIME: Row[] = [
  [
    "group",
    "Plan: Sample app v1",
    [
      "€3.35 15m",
      "€9.95 1h03m",
      "€1.73 13m",
      "€2.96 46m",
      "€6.03 58m",
      "€1.38 5m",
      "€4.35 20m",
    ],
    ["€29.74", "3h40m", "41h"],
  ],
  [
    "in-plan",
    "NAP-100Plan: Sample app v1Done",
    ["€3.35 15m c5", "·", "·", "·", "·", "·", "€1.79 5m c3"],
    ["€5.14", "20m", "1h25m"],
  ],
  [
    "in-plan",
    "NAP-107Nap feature 7Specifying",
    ["·", "·", "·", "€0.84 13m c2", "€1.70 16m c3", "·", "€1.03 5m c2"],
    ["€3.56", "34m", "6h00m"],
  ],
  [
    "in-plan",
    "NAP-108Nap feature 8Todo",
    ["·", "€2.32 15m c4", "€1.73 13m c3", "·", "·", "·", "·"],
    ["€4.05", "28m", "5h50m"],
  ],
  [
    "milestone",
    "Sample app v1: Reports",
    ["·", "€5.54 33m", "·", "€0.76 10m", "€1.55 13m", "·", "€0.85 5m"],
    ["€8.71", "1h01m", "12h"],
  ],
  [
    "in-milestone",
    "NAP-104Nap feature 4Todo",
    ["·", "€3.23 18m c5", "·", "·", "·", "·", "€0.85 5m c2"],
    ["€4.08", "23m", "4h40m"],
  ],
  [
    "in-milestone",
    "NAP-105Nap feature 5Done",
    ["·", "·", "·", "€0.76 10m c2", "€1.55 13m c3", "·", "·"],
    ["€2.32", "23m", "4h30m"],
  ],
  [
    "in-milestone",
    "NAP-106Nap feature 6Building",
    ["·", "€2.32 15m c4", "·", "·", "·", "·", "·"],
    ["€2.32", "15m", "3h20m"],
  ],
  [
    "milestone",
    "Sample app v1: Record",
    ["·", "€2.08 15m", "·", "€1.36 23m", "€2.78 29m", "€1.38 5m", "€0.68 5m"],
    ["€8.28", "1h17m", "15h"],
  ],
  [
    "in-milestone",
    "NAP-101Nap feature 1Done",
    [
      "·",
      "·",
      "·",
      "€0.66 13m c1",
      "€1.34 16m c3",
      "€1.38 5m c3",
      "€0.68 5m c2",
    ],
    ["€4.06", "39m", "7h00m"],
  ],
  [
    "in-milestone",
    "NAP-102Nap feature 2Building",
    ["·", "€2.08 15m c4", "·", "·", "·", "·", "·"],
    ["€2.08", "15m", "3h40m"],
  ],
  [
    "in-milestone",
    "NAP-103Nap feature 3Specifying",
    ["·", "·", "·", "€0.71 10m c2", "€1.44 13m c3", "·", "·"],
    ["€2.14", "23m", "4h50m"],
  ],
  [
    "group",
    "Plan: Sample tooling",
    ["·", "€2.59 18m", "·", "€0.88 10m", "€1.79 13m", "·", "€1.20 5m"],
    ["€6.46", "46m", "9h10m"],
  ],
  [
    "in-plan",
    "NAP-109Nap feature 9Done",
    ["·", "·", "·", "€0.88 10m c2", "€1.79 13m c3", "·", "·"],
    ["€2.67", "23m", "4h40m"],
  ],
  [
    "in-plan",
    "NAP-110Nap feature 10Building",
    ["·", "€2.59 18m c4", "·", "·", "·", "·", "€1.20 5m c2"],
    ["€3.79", "23m", "4h30m"],
  ],
  [
    "group",
    "Single tickets",
    ["·", "€2.56 15m", "·", "€0.94 10m", "€1.90 13m", "·", "·"],
    ["€5.40", "38m", "8h00m"],
  ],
  [
    "in-plan",
    "NAP-111Nap feature 11Specifying",
    ["·", "·", "·", "€0.94 10m c2", "€1.90 13m c3", "·", "·"],
    ["€2.84", "23m", "4h20m"],
  ],
  [
    "in-plan",
    "NAP-112Nap feature 12Todo",
    ["·", "€2.56 15m c4", "·", "·", "·", "·", "·"],
    ["€2.56", "15m", "3h40m"],
  ],
  [
    "group no-ticket",
    "No ticket",
    ["€3.35 20m c5", "·", "·", "€1.04 13m c2", "·", "·", "€1.44 5m c3"],
    ["€5.83", "38m", "7h40m"],
  ],
  [
    "total",
    "Total",
    [
      "€6.70 35m",
      "€15.09 1h36m",
      "€1.73 13m",
      "€5.83 1h19m",
      "€9.72 1h24m",
      "€1.38 5m",
      "€6.99 30m",
    ],
    ["€47.43", "5h42m", "66h"],
  ],
];

/** The craft time shade step of each phase cell of `NAP_TIME`, row by row. */
const NAP_TIME_BY_TIME = [
  "- - - - - - -",
  "c4 - - - - - c2",
  "- - - c4 c4 - c2",
  "- c4 c4 - - - -",
  "- - - - - - -",
  "- c5 - - - - c2",
  "- - - c3 c4 - -",
  "- c4 - - - - -",
  "- - - - - - -",
  "- - - c4 c4 c2 c2",
  "- c4 - - - - -",
  "- - - c3 c4 - -",
  "- - - - - - -",
  "- - - c3 c4 - -",
  "- c5 - - - - c2",
  "- - - - - - -",
  "- - - c3 c4 - -",
  "- c4 - - - - -",
  "c5 - - c4 - - c2",
  "- - - - - - -",
];

const CRAFT: Row[] = [
  [
    "group",
    "Single tickets",
    ["·", "€8.55", "·", "€1.31", "·", "·", "·"],
    ["€9.86", "—", "—"],
  ],
  [
    "in-plan",
    "CRAFT-901Fixture plan stepDone",
    ["·", "€2.79 c5", "·", "·", "·", "·", "·"],
    ["€2.79", "—", "—"],
  ],
  [
    "in-plan",
    "CRAFT-902Fixture spec stepDone",
    ["·", "€2.85 c5", "·", "·", "·", "·", "·"],
    ["€2.85", "—", "—"],
  ],
  [
    "in-plan",
    "CRAFT-903Fixture build stepDone",
    ["·", "€2.91 c5", "·", "€1.31 c3", "·", "·", "·"],
    ["€4.22", "—", "—"],
  ],
  [
    "group no-ticket",
    "No ticket",
    ["·", "·", "·", "·", "€2.51 c5", "·", "·"],
    ["€2.51", "—", "—"],
  ],
  [
    "total",
    "Total",
    ["·", "€8.55", "·", "€1.31", "€2.51", "·", "·"],
    ["€12.37", "—", "—"],
  ],
];

const NO_REPO: Row[] = [
  [
    "group no-ticket",
    "No ticket",
    ["·", "·", "·", "·", "·", "·", "€3.72 13m c5"],
    ["€3.72", "13m", "2h20m"],
  ],
  [
    "total",
    "Total",
    ["·", "·", "·", "·", "·", "·", "€3.72 13m"],
    ["€3.72", "13m", "2h20m"],
  ],
];

async function rowsOf(page: Page): Promise<Row[]> {
  const rows: Row[] = [];
  for (const tr of await page.locator("tbody tr").all()) {
    const cells = await tr
      .locator("td")
      .evaluateAll((tds) =>
        tds.map((td) => [td.className, (td as HTMLElement).innerText]),
      );
    const text = (t: string) => t.replace(/\s+/g, " ").trim();
    rows.push([
      (await tr.getAttribute("class")) ?? "",
      text(cells[0][1]).replace(/ /g, ""),
      cells.slice(1, 8).map(([cls, t]) => {
        const step = /\bc\d\b/.exec(cls)?.[0];
        return step ? `${text(t)} ${step}` : text(t);
      }),
      cells.slice(8).map(([, t]) => text(t)),
    ]);
  }
  return rows;
}

/** The rows of `expected`, with the first cell's spaces removed, as `rowsOf` reads them. */
const compact = (expected: Row[]): Row[] =>
  expected.map(([cls, first, cells, totals]) => [
    cls,
    first.replace(/ /g, ""),
    cells,
    totals,
  ]);

async function expectTopBar(page: Page) {
  const tabs = page.getByRole("navigation", { name: "Main" });
  await expect(tabs.locator('[aria-current="page"]')).toHaveText("Projects");
  await expect(tabs.getByRole("link", { name: "Projects" })).toHaveAttribute(
    "href",
    "/",
  );
}

async function expectSwitch(page: Page, path: string, current: string) {
  const toggle = page.getByRole("group", { name: "Shade by" });
  await expect(toggle.getByRole("link", { name: "€ cost" })).toHaveAttribute(
    "href",
    path,
  );
  await expect(
    toggle.getByRole("link", { name: "craft time" }),
  ).toHaveAttribute("href", `${path}?shade=time`);
  await expect(toggle.locator('[aria-current="true"]')).toHaveText(current);
}

const tiles = (page: Page) => page.locator(".summary .tile");

async function expectNoPageScroll(page: Page) {
  const widths = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client);
}

const foldButton = (page: Page, name: string): Locator =>
  page.getByRole("button", { name, exact: true });

test.describe("Projects overview links", () => {
  for (const [query, suffix] of [
    ["", ""],
    ["?shade=time", "?shade=time"],
  ])
    test(`each project name links to its project page on /${query}`, async ({
      page,
    }) => {
      await page.goto(`/${query}`);
      const links = page.locator("tbody td.name a");
      await expect(links).toHaveText([
        "NapTime",
        "Craft",
        "NapTime",
        "NapTime",
        "vanoostrum/sandbox",
        "No repository",
      ]);
      const hrefs = await links.evaluateAll((as) =>
        as.map((a) => a.getAttribute("href")),
      );
      expect(hrefs).toEqual(
        [
          "/projects/vanoostrum/nap-time",
          "/projects/vanoostrum/craft",
          "/projects/vanoostrum/nap-docs",
          "/projects/vanoostrum/nap-web",
          "/projects/vanoostrum/sandbox",
          "/projects/no-repo",
        ].map((href) => href + suffix),
      );
      await expect(page.locator("tbody td.name .repo a")).toHaveCount(0);
    });

  test("a click on a project name opens its project page, with the shade choice", async ({
    page,
  }) => {
    await page.goto("/?shade=time");
    await page.getByRole("link", { name: "Craft", exact: true }).click();
    await expect(page).toHaveURL(/\/projects\/vanoostrum\/craft\?shade=time$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "shade = craft time",
    );
    await page.goto("/");
    await page.getByRole("link", { name: "No repository" }).click();
    await expect(page).toHaveURL(/\/projects\/no-repo$/);
  });
});

test.describe("Project page", () => {
  test("NapTime shows the top bar, the crumbs, the tiles, the heading, and the notes", async ({
    page,
  }) => {
    await page.goto("/projects/vanoostrum/nap-time");
    await expect(page).toHaveTitle("NapTime · Craft Console");
    await expectTopBar(page);
    await expectSwitch(page, "/projects/vanoostrum/nap-time", "€ cost");
    await expect(page.locator(".crumbs")).toHaveText("Projects / NapTime");
    await expect(
      page.locator(".crumbs").getByRole("link", { name: "Projects" }),
    ).toHaveAttribute("href", "/");
    await expect(tiles(page).locator(".k")).toHaveText([
      "Cost",
      "Craft time",
      "Waiting on you",
      "Max share · Nov",
    ]);
    await expect(tiles(page).locator(".v")).toHaveText([
      "€47.43 *",
      "5h42m",
      "66h",
      "≈ €66",
    ]);
    await expect(tiles(page).locator("small")).toHaveText([
      "13 tickets · €3.65 a ticket",
      "26m a ticket",
      "time between craft's question and your answer",
      "estimate, of your €93 Max plan",
    ]);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "NapTime vanoostrum/nap-time / tickets × phases · each cell: cost, then craft working time · shade = cost",
    );
    await expect(
      page.getByRole("link", { name: "Open in Linear" }),
    ).toHaveAttribute("href", "https://linear.app/example/project/sample");
    await expect(page.locator("table.grid th")).toHaveText(COLUMNS);
    await expect(page.locator("p.note")).toHaveText([NOTE, MISSING]);
  });

  test("NapTime lists the plans, milestones, tickets, Single tickets, No ticket, and Total, with the cost shading", async ({
    page,
  }) => {
    await page.goto("/projects/vanoostrum/nap-time");
    expect(await rowsOf(page)).toEqual(compact(NAP_TIME));
    await expect(page.locator("tbody a")).toHaveCount(0);
  });

  test("Total and the tiles equal the NapTime overview row", async ({
    page,
  }) => {
    await page.goto("/");
    const row = page.locator("tbody tr").first();
    const cells = (await row.locator("td").allTextContents()).map((t) =>
      t.trim(),
    );
    await page.goto("/projects/vanoostrum/nap-time");
    const total = page.locator("tr.total td");
    await expect(total.nth(8)).toHaveText(cells[2].replace(" *", ""));
    await expect(total.nth(9)).toHaveText(cells[4]);
    await expect(total.nth(10)).toHaveText(cells[6]);
    await expect(tiles(page).locator(".v")).toHaveText([
      cells[2],
      cells[4],
      cells[6],
      cells[7],
    ]);
  });

  test("?shade=time shades the cells by craft time", async ({ page }) => {
    await page.goto("/projects/vanoostrum/nap-time");
    await page
      .getByRole("group", { name: "Shade by" })
      .getByRole("link", { name: "craft time" })
      .click();
    await expect(page).toHaveURL(
      /\/projects\/vanoostrum\/nap-time\?shade=time$/,
    );
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "NapTime vanoostrum/nap-time / tickets × phases · each cell: cost, then craft working time · shade = craft time",
    );
    await expectSwitch(page, "/projects/vanoostrum/nap-time", "craft time");
    const steps = await page.locator("tbody tr").evaluateAll((trs) =>
      trs.map((tr) =>
        [...tr.querySelectorAll("td")]
          .slice(1, 8)
          .map((td) => /\bc\d\b/.exec(td.className)?.[0] ?? "-")
          .join(" "),
      ),
    );
    expect(steps).toEqual(NAP_TIME_BY_TIME);
    const text = (await rowsOf(page)).map(([cls, first, cells, totals]) => [
      cls,
      first,
      cells.map((c) => c.replace(/ c\d$/, "")),
      totals,
    ]);
    expect(text).toEqual(
      compact(NAP_TIME).map(([cls, first, cells, totals]) => [
        cls,
        first,
        cells.map((c) => c.replace(/ c\d$/, "")),
        totals,
      ]),
    );
  });

  test("the switch goes back to cost, the crumb keeps the choice, and the tab goes to cost", async ({
    page,
  }) => {
    await page.goto("/projects/vanoostrum/nap-time?shade=time");
    await page
      .getByRole("group", { name: "Shade by" })
      .getByRole("link", { name: "€ cost" })
      .click();
    await expect(page).toHaveURL(/\/projects\/vanoostrum\/nap-time$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "shade = cost",
    );
    await page.goto("/projects/vanoostrum/nap-time?shade=time");
    await page
      .locator(".crumbs")
      .getByRole("link", { name: "Projects" })
      .click();
    await expect(page).toHaveURL(/\/\?shade=time$/);
    await page.goto("/projects/vanoostrum/nap-time?shade=time");
    await page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: "Projects" })
      .click();
    await expect(page).toHaveURL(/:\d+\/$/);
  });

  test("Craft has no time data: cells show cost only, time totals show —, and no cell is shaded by craft time", async ({
    page,
  }) => {
    await page.goto("/projects/vanoostrum/craft");
    await expect(page).toHaveTitle("Craft · Craft Console");
    expect(await rowsOf(page)).toEqual(compact(CRAFT));
    await expect(tiles(page).locator(".v")).toHaveText([
      "€12.37",
      "—",
      "—",
      "≈ €20",
    ]);
    await expect(tiles(page).locator("small").nth(1)).toHaveText("— a ticket");
    await expect(page.locator("p.note")).toHaveText([NOTE]);
    await page.goto("/projects/vanoostrum/craft?shade=time");
    await expect(
      page.locator(
        "tbody td.c1, tbody td.c2, tbody td.c3, tbody td.c4, tbody td.c5",
      ),
    ).toHaveCount(0);
    expect(await page.locator("body").innerText()).not.toContain("NaN");
  });

  test("No repository shows only No ticket and Total, with no repository and no Open in Linear", async ({
    page,
  }) => {
    await page.goto("/projects/no-repo");
    await expect(page).toHaveTitle("No repository · Craft Console");
    await expectTopBar(page);
    await expectSwitch(page, "/projects/no-repo", "€ cost");
    await expect(page.locator(".crumbs")).toHaveText(
      "Projects / No repository",
    );
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "No repository / tickets × phases · each cell: cost, then craft working time · shade = cost",
    );
    await expect(
      page.getByRole("link", { name: "Open in Linear" }),
    ).toHaveCount(0);
    await expect(tiles(page).locator(".v")).toHaveText([
      "€3.72",
      "13m",
      "2h20m",
      "≈ €6",
    ]);
    await expect(tiles(page).locator("small")).toHaveText([
      "0 tickets · — a ticket",
      "— a ticket",
      "time between craft's question and your answer",
      "estimate, of your €93 Max plan",
    ]);
    expect(await rowsOf(page)).toEqual(compact(NO_REPO));
    await expect(page.locator("p.note")).toHaveText([
      "Sessions that ran outside a repository. A brief session moves to the project of the plan that links its brief, once that plan exists.",
    ]);
  });

  test("Sandbox has no Open in Linear, because its ticket has no Linear project", async ({
    page,
  }) => {
    await page.goto("/projects/vanoostrum/sandbox");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "vanoostrum/sandbox",
    );
    await expect(tiles(page).locator("small").first()).toHaveText(
      "1 ticket · €0.00 a ticket",
    );
    await expect(
      page.getByRole("link", { name: "Open in Linear" }),
    ).toHaveCount(0);
  });

  for (const [path, shown] of [
    ["/projects/vanoostrum/unknown", "vanoostrum/unknown"],
    ["/projects/nobody/nap-time", "nobody/nap-time"],
  ])
    test(`${path} is a 404 page that links back to Projects`, async ({
      page,
    }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(404);
      await expect(page).toHaveTitle("Not found · Craft Console");
      await expectTopBar(page);
      await expect(page.locator(".crumbs")).toHaveText(`Projects / ${shown}`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        `No sessions for ${shown} / craft has no session in this repository. Check the address, or go back to Projects.`,
      );
      await expect(
        page.getByRole("link", { name: "Back to Projects" }),
      ).toHaveAttribute("href", "/");
    });
});

test.describe("Folding", () => {
  test("every group starts open with a fold button; No ticket and Total have none", async ({
    page,
  }) => {
    await page.goto("/projects/vanoostrum/nap-time");
    const buttons = page.locator("tbody button.fold");
    await expect(buttons).toHaveCount(5);
    for (const name of [
      "Plan: Sample app v1",
      "Sample app v1: Reports",
      "Sample app v1: Record",
      "Plan: Sample tooling",
      "Single tickets",
    ]) {
      const button = foldButton(page, `Fold ${name}`);
      await expect(button).toHaveAttribute("aria-expanded", "true");
    }
    await expect(
      page.locator("tr.no-ticket button, tr.total button"),
    ).toHaveCount(0);
  });

  test("folding a group hides its rows and keeps the subtotals; a second click shows them", async ({
    page,
  }) => {
    await page.goto("/projects/vanoostrum/nap-time");
    const visible = page.locator("tbody tr:visible");
    await expect(visible).toHaveCount(20);
    await foldButton(page, "Fold Plan: Sample tooling").click();
    const open = foldButton(page, "Open Plan: Sample tooling");
    await expect(open).toHaveAttribute("aria-expanded", "false");
    await expect(visible).toHaveCount(18);
    await expect(page.getByText("NAP-109")).toBeHidden();
    await expect(
      page.locator("tr", { has: open }).locator("td").nth(8),
    ).toHaveText("€6.46");
    await expect(page.locator("tr.total td").nth(8)).toHaveText("€47.43");
    await open.click();
    await expect(foldButton(page, "Fold Plan: Sample tooling")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await expect(visible).toHaveCount(20);
  });

  test("a milestone keeps its fold state while its plan folds and opens, and a reload opens every group", async ({
    page,
  }) => {
    await page.goto("/projects/vanoostrum/nap-time");
    const visible = page.locator("tbody tr:visible");
    await foldButton(page, "Fold Sample app v1: Reports").click();
    await expect(visible).toHaveCount(17);
    await foldButton(page, "Fold Plan: Sample app v1").click();
    await expect(visible).toHaveCount(9);
    await expect(page.getByText("NAP-100")).toBeHidden();
    await foldButton(page, "Open Plan: Sample app v1").click();
    const reports = foldButton(page, "Open Sample app v1: Reports");
    await expect(reports).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByText("NAP-104")).toBeHidden();
    await expect(page.getByText("NAP-101")).toBeVisible();
    await expect(visible).toHaveCount(17);
    await expect(page.locator("tr.total td").nth(8)).toHaveText("€47.43");
    await page.reload();
    await expect(visible).toHaveCount(20);
    await expect(
      page.locator('tbody button[aria-expanded="false"]'),
    ).toHaveCount(0);
  });
});

for (const [name, path] of [
  ["project", "/projects/vanoostrum/nap-time"],
  ["project-time", "/projects/vanoostrum/nap-time?shade=time"],
  ["project-no-repository", "/projects/no-repo"],
  ["project-not-found", "/projects/vanoostrum/unknown"],
] as const)
  for (const [platform, viewport] of [
    ["desktop", { width: 1280, height: 800 }],
    ["mobile", { width: 390, height: 844 }],
  ] as const)
    test(`${name} fits the ${platform} width with no page scroll`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto(path);
      await expect(page.locator("main .panel")).toBeVisible();
      await expectNoPageScroll(page);
      if (name !== "project-not-found") {
        const overflow = await page
          .locator(".panel")
          .evaluate((el) => el.scrollWidth - el.clientWidth);
        if (platform === "mobile") expect(overflow).toBeGreaterThan(0);
      }
      await page.screenshot({
        path: `screenshots/${name}_${platform}.png`,
        fullPage: true,
      });
    });
