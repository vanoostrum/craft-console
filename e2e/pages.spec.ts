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

test.describe("Projects", () => {
  test("shows the heading, the bucket link, and the table", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveTitle("Projects · Craft Console");
    await expectTopBar(page, "Projects");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Projects / sessions in the transcript bucket, tickets in Linear",
    );
    const bucket = page.getByRole("link", { name: "Open the bucket" });
    await expect(bucket).toHaveAttribute("href", BUCKET);
    await expect(bucket).not.toHaveAttribute("target", /.+/);
    await expect(page.getByRole("columnheader")).toHaveText([
      "Repository",
      "Sessions",
      "Tickets",
    ]);
  });

  test("lists the fixture rows in order, with No repository last", async ({
    page,
  }) => {
    await page.goto("/");
    const rows = page.locator("tbody tr");
    await expect(rows).toHaveCount(3);
    const cells = async (index: number) =>
      (await rows.nth(index).locator("td").allTextContents()).map((text) =>
        text.trim(),
      );
    expect(await cells(0)).toEqual(["vanoostrum/nap-time", "15", "12"]);
    expect(await cells(1)).toEqual(["vanoostrum/craft", "4", "3"]);
    expect(await cells(2)).toEqual(["No repository", "2", "0"]);
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
  await expect(page.locator("tbody tr")).toHaveCount(3);
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
      await page.screenshot({
        path: `screenshots/${name}_${platform}.png`,
        fullPage: true,
      });
    });
  }
}
