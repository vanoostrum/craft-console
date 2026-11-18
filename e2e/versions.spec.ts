import { expect, test, type Locator, type Page } from "@playwright/test";

// The Craft versions page on the fixtures, with CONSOLE_NOW=2026-11-22T12:00:00Z.

const RELEASES = "https://github.com/vanoostrum/craft/releases";

const COLUMNS = [
  "Version",
  "Tickets",
  "plan",
  "spec",
  "design",
  "build",
  "review",
  "merge",
  "other",
  "cost a ticket",
  "time a ticket",
];

const NOTE =
  'A phase counts toward the craft version that ran it. A cell is the average over the tickets that had that phase on that version, and "cost a ticket" is the sum of the cells. Work that names no ticket is left out. Craft time averages only over the tickets with time data. Sessions without a known craft version are under "Unknown version" and are not compared.';

const MISSING =
  "* Some cost is missing: claude-opus-6 is not in the price table. Its tokens are left out of the cost.";

/** A phase cell: cost, craft time (null: none), the cost class, the craft time class. Null: `·`. */
type Cell = [string, string | null, string | null, string | null] | null;
/** A total: its text, then the change line's text and class, or null for no change line. */
type Total = [string, [string, string] | null];

type Row = {
  version: string | null;
  tickets: string;
  cells: Cell[];
  cost: Total;
  time: Total;
};

/** Written by hand from `src/fixtures/`, at the price table. */
const ROWS: Row[] = [
  {
    version: "2.9.0",
    tickets: "7",
    cells: [
      ["€3.35", "15m", "c5", "c4"],
      ["€0.82", "18m", "c2", "c5"],
      null,
      ["€0.21", "20m", "c1", "c5"],
      null,
      ["€1.38", "5m", "c3", "c2"],
      ["€1.79", "5m", "c3", "c2"],
    ],
    cost: ["€7.54", ["▲ 27% vs 2.8.2", "delta up"]],
    time: ["1h03m", ["▲ 24% vs 2.8.2", "delta up"]],
  },
  {
    version: "2.8.2",
    tickets: "5",
    cells: [
      null,
      ["€2.71", "17m", "c5", "c5"],
      null,
      ["€0.75", "13m", "c2", "c4"],
      ["€1.52", "16m", "c3", "c4"],
      null,
      ["€0.94", "5m", "c2", "c2"],
    ],
    cost: ["€5.92 *", ["▼ 6% vs 2.8.1", "delta down"]],
    time: ["51m", ["0% vs 2.8.1", "delta"]],
  },
  {
    version: "2.8.1",
    tickets: "5",
    cells: [
      null,
      ["€2.20", "15m", "c4", "c4"],
      ["€1.73", "13m", "c3", "c4"],
      ["€0.78", "10m", "c2", "c3"],
      ["€1.59", "13m", "c3", "c4"],
      null,
      null,
    ],
    cost: ["€6.31", ["▲ 52% vs 2.8.0", "delta up"]],
    time: ["51m", null],
  },
  {
    version: "2.8.0",
    tickets: "2",
    cells: [
      null,
      ["€2.85", null, "c5", null],
      null,
      ["€1.31", null, "c2", null],
      null,
      null,
      null,
    ],
    cost: ["€4.16", ["first version", "delta"]],
    time: ["—", null],
  },
  {
    version: null,
    tickets: "2",
    cells: [
      null,
      ["€2.56", "15m", null, null],
      null,
      ["€0.94", "10m", null, null],
      ["€1.90", "13m", null, null],
      null,
      null,
    ],
    cost: ["€5.40", null],
    time: ["38m", null],
  },
];

async function expectTotal(td: Locator, [text, delta]: Total) {
  const own = await td.evaluate((el) =>
    [...el.childNodes]
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent)
      .join(""),
  );
  expect(own).toBe(text);
  const span = td.locator("span.delta");
  if (delta === null) await expect(span).toHaveCount(0);
  else {
    await expect(span).toHaveText(delta[0]);
    await expect(span).toHaveAttribute("class", delta[1]);
  }
}

async function expectGrid(page: Page, shade: "cost" | "time") {
  await expect(page.locator("table.grid th")).toHaveText(COLUMNS);
  const rows = page.locator("table.grid tbody tr");
  await expect(rows).toHaveCount(ROWS.length);
  for (const [index, row] of ROWS.entries()) {
    const tr = rows.nth(index);
    const tds = tr.locator("td");
    await expect(tds).toHaveCount(COLUMNS.length);
    if (row.version === null) {
      await expect(tr).toHaveClass("unknown");
      await expect(tds.nth(0)).toHaveText("Unknown version");
      await expect(tds.nth(0).locator(".key")).toHaveCount(0);
    } else {
      await expect(tr).not.toHaveClass(/unknown/);
      await expect(tds.nth(0).locator("span.key")).toHaveText(row.version);
    }
    await expect(tds.nth(1)).toHaveText(row.tickets);
    for (const [i, cell] of row.cells.entries()) {
      const td = tds.nth(2 + i);
      if (cell === null) {
        await expect(td).toHaveAttribute("class", "empty");
        await expect(td).toHaveText("·");
        continue;
      }
      const [cost, time, costClass, timeClass] = cell;
      await expect(td.locator("div")).toHaveText(
        time === null ? [cost] : [cost, time],
      );
      const step = shade === "cost" ? costClass : timeClass;
      await expect(td).toHaveAttribute(
        "class",
        step === null ? "cell" : `cell ${step}`,
      );
    }
    await expect(tds.nth(9)).toHaveAttribute("class", "tot sep");
    await expect(tds.nth(10)).toHaveAttribute("class", "tot");
    await expectTotal(tds.nth(9), row.cost);
    await expectTotal(tds.nth(10), row.time);
  }
  await expect(page.locator("main")).not.toContainText("NaN");
}

async function expectFrame(page: Page, shade: "cost" | "time") {
  await expect(page).toHaveTitle("Craft versions · Craft Console");
  const tabs = page.getByRole("navigation", { name: "Main" });
  await expect(tabs.locator('[aria-current="page"]')).toHaveText(
    "Craft versions",
  );
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    `Craft versions / average per ticket, all projects · each cell: cost, then craft working time · shade = ${shade === "cost" ? "cost" : "craft time"}`,
  );
  await expect(page.locator(".panel-head > h1")).toHaveCount(1);
  await expect(
    page.getByRole("link", { name: "Craft releases" }),
  ).toHaveAttribute("href", RELEASES);
  const toggle = page.getByRole("group", { name: "Shade by" });
  await expect(toggle.getByRole("link", { name: "€ cost" })).toHaveAttribute(
    "href",
    "/versions",
  );
  await expect(
    toggle.getByRole("link", { name: "craft time" }),
  ).toHaveAttribute("href", "/versions?shade=time");
  await expect(toggle.locator('[aria-current="true"]')).toHaveText(
    shade === "cost" ? "€ cost" : "craft time",
  );
  await expect(page.getByText("Back to Projects")).toHaveCount(0);
  await expect(page.locator(".read-at")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("Read at");
  await expect(page.locator("p.note")).toHaveText([NOTE, MISSING]);
}

test("/versions shows each craft version, newest first, with Unknown version last, shaded by cost", async ({
  page,
}) => {
  await page.goto("/versions");
  await expectFrame(page, "cost");
  await expectGrid(page, "cost");
});

test("the Shade by switch shades the grid by craft time and back", async ({
  page,
}) => {
  await page.goto("/versions");
  const toggle = page.getByRole("group", { name: "Shade by" });
  await toggle.getByRole("link", { name: "craft time" }).click();
  await expect(page).toHaveURL(/\/versions\?shade=time$/);
  await expectFrame(page, "time");
  await expectGrid(page, "time");
  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Projects" })
    .click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/versions?shade=time");
  await toggle.getByRole("link", { name: "€ cost" }).click();
  await expect(page).toHaveURL(/\/versions$/);
  await expectFrame(page, "cost");
  await expectGrid(page, "cost");
});

for (const query of ["?shade=TIME", "?shade=", "?shade=cost", "?shade=x"])
  test(`/versions${query} shades by cost`, async ({ page }) => {
    await page.goto(`/versions${query}`);
    await expectFrame(page, "cost");
    await expectGrid(page, "cost");
  });

test("the tabs go to the pages with no shade", async ({ page }) => {
  await page.goto("/versions?shade=time");
  const tabs = page.getByRole("navigation", { name: "Main" });
  await expect(tabs.getByRole("link", { name: "Projects" })).toHaveAttribute(
    "href",
    "/",
  );
  await expect(
    tabs.getByRole("link", { name: "Craft versions" }),
  ).toHaveAttribute("href", "/versions");
});
