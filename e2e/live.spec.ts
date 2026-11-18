import { expect, test, type Page } from "@playwright/test";
import {
  freePort,
  LiveStub,
  scenario,
  session,
  startLiveApp,
  ticket,
  type App,
} from "./live-stub";

// The Projects page on CONSOLE_DATA=live, against a local stub of the bucket
// and Linear. Each test starts its own app, so each starts with no cached read.

test.describe.configure({ mode: "serial" });

const NO_NUMBERS =
  "The page shows no numbers until the transcript bucket and Linear can both be read.";

const BASE = scenario(
  [
    session("vanoostrum/alpha", "a1", ["ALP-1"]),
    session("vanoostrum/alpha", "a2", ["ALP-1", "ALP-2"]),
    session("vanoostrum/alpha", "a3", ["ALP-2", "ALP-3"]),
    session("vanoostrum/beta", "b1", ["BET-1"]),
    session("no-repo", "n1", []),
  ],
  ["ALP-1", "ALP-2", "ALP-3", "BET-1"],
);
// ALP-1 is a plan ticket that links a brief, and the parent of ALP-2.
const DEFAULT = {
  ...BASE,
  tickets: {
    ...BASE.tickets,
    "ALP-1": {
      ...ticket("ALP-1"),
      title: "Plan: Synthetic plan",
      description:
        "See [Brief: Synthetic](https://linear.app/example/document/brief-synthetic-0123456789ab).",
    },
    "ALP-2": { ...ticket("ALP-2"), parent: { identifier: "ALP-1" } },
  },
};
const DEFAULT_ROWS = [
  ["vanoostrum/alpha", "3", "3"],
  ["vanoostrum/beta", "1", "1"],
  ["No repository", "1", "0"],
];

const stub = new LiveStub();
let app: App | undefined;

test.beforeAll(() => stub.start());
test.afterAll(() => stub.stop());
test.beforeEach(() => {
  stub.seen = [];
  stub.scenario = DEFAULT;
});
test.afterEach(() => {
  app?.stop();
  app = undefined;
});

async function start(env: Record<string, string> = {}) {
  app = await startLiveApp(stub, env);
  return app;
}

/**
 * Each overview row as [repository or "No repository", sessions, tickets]. The
 * empty row is [its text].
 */
async function rows(page: Page): Promise<string[][]> {
  return page.locator("tbody tr").evaluateAll((trs) =>
    trs.map((tr) => {
      const cells = [...tr.querySelectorAll("td")];
      if (cells[0].classList.contains("empty-row"))
        return [cells[0].textContent!.trim()];
      const name =
        cells[0].querySelector(".repo")?.textContent ??
        cells[0].textContent!.trim();
      return [
        name,
        tr.getAttribute("data-sessions")!,
        cells[1].textContent!.trim(),
      ];
    }),
  );
}

const COLUMNS = [
  "Project",
  "Tickets",
  "Cost",
  "Avg cost",
  "Craft time",
  "Avg time",
  "Waiting on you",
  /^Max share · [A-Z][a-z]{2}$/,
  "Phase mix · cost",
];

/** No page shows when the app read the data. */
async function expectNoReadAt(page: Page) {
  await expect(page.locator(".read-at")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("Read at");
}

test("lists each repository with sessions from the bucket and tickets from Linear, with no read time", async ({
  page,
}) => {
  const { url } = await start();
  await page.goto(url);
  expect(await rows(page)).toEqual(DEFAULT_ROWS);
  await expectNoReadAt(page);
  await expect(page.locator(".panel-head > h1")).toHaveCount(1);
  await expect(page.getByRole("columnheader")).toHaveText(COLUMNS);
  // Stub sessions have no segments: no cost, no craft time.
  const alpha = page.locator("tbody tr").first().locator("td");
  await expect(alpha).toHaveText([
    "Synthetic projectvanoostrum/alpha",
    "3",
    "€0.00",
    "€0.00",
    "—",
    "—",
    "—",
    /^(≈ €\d+|—)$/,
    "",
  ]);
  await expect(alpha.locator(".mix")).toHaveAttribute("title", "no cost");
  await expect(page.locator("main").getByRole("status")).toHaveCount(0);
  await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
});

test("with no credentials, sends no Authorization header to the bucket or Linear", async ({
  page,
}) => {
  const { url } = await start();
  await page.goto(url);
  expect(await rows(page)).toEqual(DEFAULT_ROWS);
  expect(stub.reads("gcs").length).toBeGreaterThan(0);
  expect(stub.reads("linear").length).toBeGreaterThan(0);
  expect(stub.seen.map((r) => r.authorization)).toEqual(
    stub.seen.map(() => undefined),
  );
});

test("sends LINEAR_API_KEY as the Authorization header to Linear only", async ({
  page,
}) => {
  const { url } = await start({ LINEAR_API_KEY: "lin_api_synthetic" });
  await page.goto(url);
  expect(await rows(page)).toEqual(DEFAULT_ROWS);
  expect(stub.reads("linear").map((r) => r.authorization)).toEqual(
    stub.reads("linear").map(() => "lin_api_synthetic"),
  );
  expect(stub.reads("gcs").every((r) => r.authorization === undefined)).toBe(
    true,
  );
});

test("keeps a read: the next request makes no new read", async ({ page }) => {
  const { url } = await start();
  await page.goto(url);
  const reads = stub.seen.length;
  stub.scenario = scenario([], []);
  await page.reload();
  expect(await rows(page)).toEqual(DEFAULT_ROWS);
  expect(stub.seen.length).toBe(reads);
});

test("an empty bucket shows the table header and the empty row", async ({
  page,
}) => {
  stub.scenario = scenario([], []);
  const { url } = await start();
  await page.goto(url);
  await expect(page.getByRole("columnheader")).toHaveText(COLUMNS);
  expect(await rows(page)).toEqual([
    ["No sessions in the transcript bucket yet."],
  ]);
  await expect(page.locator("td.empty-row")).toHaveAttribute("colspan", "9");
  await expectNoReadAt(page);
});

test("a failed bucket read shows the error and no numbers, and is not kept", async ({
  page,
}) => {
  stub.scenario = { ...DEFAULT, listStatus: 403 };
  const { url } = await start();
  await page.goto(url);
  await expect(page.locator("main").getByRole("alert")).toHaveText(
    `Could not read the transcript bucket: 403 Forbidden. ${NO_NUMBERS}`,
  );
  await expect(page.locator("table")).toHaveCount(0);
  await expect(page.locator(".read-at")).toHaveCount(0);
  expect(stub.reads("linear")).toHaveLength(0);

  stub.scenario = DEFAULT;
  await page.reload();
  expect(await rows(page)).toEqual(DEFAULT_ROWS);
  await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
});

test("a session file that cannot be fetched fails the bucket read", async ({
  page,
}) => {
  stub.scenario = {
    ...DEFAULT,
    files: {
      ...DEFAULT.files,
      "vanoostrum/beta/sessions/b1/metadata.json": 404,
    },
  };
  const { url } = await start();
  await page.goto(url);
  await expect(page.locator("main").getByRole("alert")).toHaveText(
    `Could not read the transcript bucket: 404 Not Found. ${NO_NUMBERS}`,
  );
  await expect(page.locator("table")).toHaveCount(0);
});

test("a failed Linear read with a working bucket shows the error, not ticket counts of 0, and the next request reads again", async ({
  page,
}) => {
  stub.scenario = { ...DEFAULT, linearStatus: 500 };
  const { url } = await start();
  await page.goto(url);
  await expect(page.locator("main").getByRole("alert")).toHaveText(
    `Could not read Linear: 500 Internal Server Error. ${NO_NUMBERS}`,
  );
  await expect(page.locator("table")).toHaveCount(0);
  await expect(page.locator(".read-at")).toHaveCount(0);

  const linearReads = stub.reads("linear").length;
  stub.scenario = DEFAULT;
  await page.reload();
  expect(await rows(page)).toEqual(DEFAULT_ROWS);
  expect(stub.reads("linear").length).toBeGreaterThan(linearReads);
});

test("a Linear that cannot be reached shows the network error", async ({
  page,
}) => {
  const closed = await freePort();
  const { url } = await start({
    CONSOLE_LINEAR_URL: `http://127.0.0.1:${closed}`,
  });
  await page.goto(url);
  await expect(page.locator("main").getByRole("alert")).toContainText(
    `Could not read Linear: connect ECONNREFUSED 127.0.0.1:${closed}.`,
  );
});

test("session files that do not parse are not counted, and a notice lists them", async ({
  page,
}) => {
  const bad = [
    "vanoostrum/alpha/sessions/bad-json/metadata.json",
    "vanoostrum/beta/sessions/bad-shape/metadata.json",
  ];
  stub.scenario = {
    ...DEFAULT,
    pages: [[...DEFAULT.pages[0], ...bad]],
    files: {
      ...DEFAULT.files,
      [bad[0]]: '{"repo": "vanoostrum/alpha",',
      [bad[1]]: JSON.stringify({ repo: "vanoostrum/beta", tickets: "BET-9" }),
    },
  };
  const { url } = await start();
  await page.goto(url);
  const notice = page.locator("main").getByRole("status");
  await expect(notice).toContainText(
    "2 session files could not be read and are not counted:",
  );
  await expect(notice.locator("li")).toHaveText(bad);
  expect(await rows(page)).toEqual(DEFAULT_ROWS);
});

test("one session file that does not parse gets the singular notice", async ({
  page,
}) => {
  const bad = "vanoostrum/alpha/sessions/bad-json/metadata.json";
  stub.scenario = {
    ...DEFAULT,
    pages: [[...DEFAULT.pages[0], bad]],
    files: { ...DEFAULT.files, [bad]: "not json" },
  };
  const { url } = await start();
  await page.goto(url);
  await expect(page.locator("main").getByRole("status")).toContainText(
    "1 session file could not be read and is not counted:",
  );
  await expect(
    page.locator("main").getByRole("status").locator("li"),
  ).toHaveText([bad]);
});

test("counts every session of a listing over two pages", async ({ page }) => {
  const [first, second] = [
    DEFAULT.pages[0].slice(0, 5),
    DEFAULT.pages[0].slice(5),
  ];
  stub.scenario = { ...DEFAULT, pages: [first, second] };
  const { url } = await start();
  await page.goto(url);
  expect(await rows(page)).toEqual(DEFAULT_ROWS);
  expect(
    stub.reads("gcs").filter((r) => r.path.includes("pageToken=1")),
  ).toHaveLength(1);
});

test("a key that Linear does not find does not drop the other keys of its chunk", async ({
  page,
}) => {
  stub.scenario = scenario(
    [session("vanoostrum/alpha", "a1", ["ALP-1", "ALP-404", "ALP-2"])],
    ["ALP-1", "ALP-2"],
  );
  const { url } = await start();
  await page.goto(url);
  expect(await rows(page)).toEqual([["vanoostrum/alpha", "1", "2"]]);
  expect(stub.reads("linear").map((r) => r.keys)).toEqual([
    ["ALP-1", "ALP-404", "ALP-2"],
    ["ALP-1", "ALP-2"],
  ]);
});

test("a chunk where Linear finds no key counts no tickets and stops", async ({
  page,
}) => {
  stub.scenario = scenario(
    [session("vanoostrum/alpha", "a1", ["ALP-404"])],
    [],
  );
  const { url } = await start();
  await page.goto(url);
  expect(await rows(page)).toEqual([["vanoostrum/alpha", "1", "0"]]);
  expect(stub.reads("linear")).toHaveLength(1);
});

test("asks Linear for the keys in chunks of 50", async ({ page }) => {
  const keys = Array.from({ length: 55 }, (_, i) => `ALP-${i + 1}`);
  stub.scenario = scenario([session("vanoostrum/alpha", "a1", keys)], keys);
  const { url } = await start();
  await page.goto(url);
  expect(await rows(page)).toEqual([["vanoostrum/alpha", "1", "55"]]);
  expect(stub.reads("linear").map((r) => r.keys!.length)).toEqual([50, 5]);
});

test("a key that Linear resolves to a ticket with a new key counts under the key the session names", async ({
  page,
}) => {
  stub.scenario = {
    ...scenario([session("vanoostrum/alpha", "a1", ["OLD-7"])], []),
    tickets: { "OLD-7": ticket("NEW-7") },
  };
  const { url } = await start();
  await page.goto(url);
  expect(await rows(page)).toEqual([["vanoostrum/alpha", "1", "1"]]);
});

test("an error shows no credential, on the page or in the server log", async ({
  page,
}) => {
  const MARKER = "MARKER-91c2-SECRET";
  stub.scenario = { ...DEFAULT, linearStatus: 500 };
  let live = await start({ LINEAR_API_KEY: `lin_api_${MARKER}` });
  await page.goto(live.url);
  await expect(page.locator("main").getByRole("alert")).toHaveText(
    `Could not read Linear: 500 Internal Server Error. ${NO_NUMBERS}`,
  );
  expect(await page.content()).not.toContain(MARKER);
  expect(live.log()).not.toContain(MARKER);
  live.stop();

  stub.scenario = DEFAULT;
  stub.seen = [];
  live = await start({
    GCS_CREDENTIALS_JSON: `{"private_key": "${MARKER}"`,
  });
  await page.goto(live.url);
  await expect(page.locator("main").getByRole("alert")).toHaveText(
    `Could not read the transcript bucket: GCS_CREDENTIALS_JSON is not a valid service account key. ${NO_NUMBERS}`,
  );
  expect(await page.content()).not.toContain(MARKER);
  expect(live.log()).not.toContain(MARKER);
  expect(stub.reads("gcs")).toHaveLength(0);
});

test.describe("project page", () => {
  test("a stub repository opens with its heading, Open in Linear, no read time, and only a Total row", async ({
    page,
  }) => {
    const { url } = await start();
    const response = await page.goto(`${url}/projects/vanoostrum/alpha`);
    expect(response?.status()).toBe(200);
    await expect(page.locator("main h1")).toHaveText(
      /^Synthetic project vanoostrum\/alpha \/ tickets × phases/,
    );
    await expect(
      page.getByRole("link", { name: "Open in Linear" }),
    ).toHaveAttribute("href", "https://linear.app/example/project/synthetic");
    await expectNoReadAt(page);
    await expect(page.locator(".panel-head > h1")).toHaveCount(1);
    // Stub sessions have no segments: the grid has only Total.
    const total = page.locator("table.grid tbody tr");
    await expect(total).toHaveCount(1);
    await expect(total.locator("td").first()).toHaveText("Total");
    await expect(total.locator("td.tot")).toHaveText(["€0.00", "—"]);
    await expect(page.locator("main").getByRole("status")).toHaveCount(0);
  });

  test("an unknown repository is a 404 page", async ({ page }) => {
    const { url } = await start();
    const response = await page.goto(`${url}/projects/vanoostrum/unknown`);
    expect(response?.status()).toBe(404);
    await expect(page.locator("main h1")).toContainText(
      "No sessions for vanoostrum/unknown",
    );
  });

  test("asks Linear for a parent ticket that no session names, after the tickets the sessions name", async ({
    page,
  }) => {
    stub.scenario = {
      ...DEFAULT,
      tickets: {
        ...DEFAULT.tickets,
        "ALP-3": { ...ticket("ALP-3"), parent: { identifier: "ALP-9" } },
        "ALP-9": ticket("ALP-9"),
      },
    };
    const { url } = await start();
    await page.goto(`${url}/projects/vanoostrum/alpha`);
    const keys = stub.reads("linear").map((read) => read.keys);
    expect(keys.at(-1)).toEqual(["ALP-9"]);
    expect(keys.slice(0, -1).flat()).not.toContain("ALP-9");
    await page.goto(url);
    expect(await rows(page)).toEqual(DEFAULT_ROWS);
  });

  test("a failed read shows the top bar, the crumbs, and the error, and no numbers", async ({
    page,
  }) => {
    stub.scenario = { ...DEFAULT, linearStatus: 500 };
    const { url } = await start();
    const response = await page.goto(`${url}/projects/vanoostrum/alpha`);
    expect(response?.status()).toBe(200);
    await expect(page.locator(".topbar")).toBeVisible();
    await expect(page.locator(".crumbs")).toHaveText(
      "Projects / vanoostrum/alpha",
    );
    await expect(page.locator("main").getByRole("alert")).toHaveText(
      `Could not read Linear: 500 Internal Server Error. ${NO_NUMBERS}`,
    );
    await expect(page.locator(".summary")).toHaveCount(0);
    await expect(page.locator("table")).toHaveCount(0);
    await expect(page.locator(".read-at")).toHaveCount(0);
  });

  test("the skipped-files notice shows on the project page as on /", async ({
    page,
  }) => {
    const bad = "vanoostrum/alpha/sessions/bad-json/metadata.json";
    stub.scenario = {
      ...DEFAULT,
      pages: [[...DEFAULT.pages[0], bad]],
      files: { ...DEFAULT.files, [bad]: "not json" },
    };
    const { url } = await start();
    await page.goto(`${url}/projects/no-repo`);
    await expectNoReadAt(page);
    const notice = page.locator("main").getByRole("status");
    await expect(notice).toContainText(
      "1 session file could not be read and is not counted:",
    );
    await expect(notice.locator("li")).toHaveText([bad]);
  });
});

test.describe("Craft versions page", () => {
  const HEADING =
    "Craft versions / average per ticket, all projects · each cell: cost, then craft working time · shade = cost";

  async function expectHead(page: Page) {
    await expect(page.locator(".topbar")).toBeVisible();
    await expect(page.getByRole("group", { name: "Shade by" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(HEADING);
    await expect(
      page.getByRole("link", { name: "Craft releases" }),
    ).toHaveAttribute("href", "https://github.com/vanoostrum/craft/releases");
    await expectNoReadAt(page);
  }

  const EMPTY = "No craft version has finished a ticket yet.";

  test("stub sessions with no segments show the empty line, with no grid and no note", async ({
    page,
  }) => {
    const { url } = await start();
    await page.goto(`${url}/versions`);
    await expectHead(page);
    await expect(page.locator("p.note")).toHaveText([EMPTY]);
    await expect(page.locator("table")).toHaveCount(0);
    await expect(page.locator("main").getByRole("status")).toHaveCount(0);
    await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
  });

  test("the skipped-files notice sits under the panel head, above the empty line", async ({
    page,
  }) => {
    const bad = [
      "vanoostrum/alpha/sessions/bad-json/metadata.json",
      "vanoostrum/beta/sessions/bad-shape/metadata.json",
    ];
    stub.scenario = {
      ...DEFAULT,
      pages: [[...DEFAULT.pages[0], ...bad]],
      files: {
        ...DEFAULT.files,
        [bad[0]]: "not json",
        [bad[1]]: JSON.stringify({ repo: "vanoostrum/beta" }),
      },
    };
    const { url } = await start();
    await page.goto(`${url}/versions`);
    await expectHead(page);
    const notice = page.locator(".panel-head + [role=status]");
    await expect(notice).toContainText(
      "2 session files could not be read and are not counted:",
    );
    await expect(notice.locator("li")).toHaveText(bad);
    await expect(page.locator("[role=status] + p.note")).toHaveText(EMPTY);
  });

  test("a failed bucket read shows the error under the panel head, with no grid and no note, and is not kept", async ({
    page,
  }) => {
    stub.scenario = { ...DEFAULT, listStatus: 403 };
    const { url } = await start();
    await page.goto(`${url}/versions`);
    await expectHead(page);
    await expect(page.locator(".panel-head + [role=alert]")).toHaveText(
      `Could not read the transcript bucket: 403 Forbidden. ${NO_NUMBERS}`,
    );
    await expect(page.locator("table")).toHaveCount(0);
    await expect(page.locator("p.note")).toHaveCount(0);

    stub.scenario = DEFAULT;
    await page.reload();
    await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
    await expect(page.locator("p.note")).toHaveText([EMPTY]);
  });

  test("a failed Linear read shows the error, and the next request reads again", async ({
    page,
  }) => {
    stub.scenario = { ...DEFAULT, linearStatus: 500 };
    const { url } = await start();
    await page.goto(`${url}/versions`);
    await expectHead(page);
    await expect(page.locator(".panel-head + [role=alert]")).toHaveText(
      `Could not read Linear: 500 Internal Server Error. ${NO_NUMBERS}`,
    );
    await expect(page.locator("table")).toHaveCount(0);
    await expect(page.locator("p.note")).toHaveCount(0);

    const linearReads = stub.reads("linear").length;
    stub.scenario = DEFAULT;
    await page.reload();
    await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
    await expect(page.locator("p.note")).toHaveText([EMPTY]);
    expect(stub.reads("linear").length).toBeGreaterThan(linearReads);
  });
});
