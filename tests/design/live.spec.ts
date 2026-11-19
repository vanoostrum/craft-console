import { expect, test } from "@playwright/test";
import {
  LiveStub,
  scenario,
  session,
  startLiveApp,
  type App,
  type Scenario,
} from "../../e2e/live-stub";
import { onePrimary, pageChecks, PLATFORMS } from "./checks";

// Projects and Craft versions on CONSOLE_DATA=live, against the synthetic
// stub, in the states the fixtures cannot reach: empty, error, and skipped
// files. These match design/pages/projects/ and design/pages/craft-versions/
// empty.html, error.html, and skipped-files.html.

test.describe.configure({ mode: "serial" });

const GOOD = scenario(
  [
    session("vanoostrum/alpha", "a1", ["ALP-1"]),
    session("vanoostrum/beta", "b1", ["BET-1"]),
  ],
  ["ALP-1", "BET-1"],
);
const BAD = "vanoostrum/alpha/sessions/bad-json/metadata.json";

const STATES: { name: string; scenario: Scenario; expect: string }[] = [
  { name: "empty", scenario: scenario([], []), expect: "td.empty-row, main p" },
  { name: "error", scenario: { ...GOOD, listStatus: 403 }, expect: ".notice.error" },
  {
    name: "skipped-files",
    scenario: {
      ...GOOD,
      pages: [[...GOOD.pages[0], BAD]],
      files: { ...GOOD.files, [BAD]: "not json" },
    },
    expect: ".notice",
  },
];

const stub = new LiveStub();
let app: App | undefined;

test.beforeAll(() => stub.start());
test.afterAll(() => stub.stop());
test.afterEach(() => {
  app?.stop();
  app = undefined;
});

for (const state of STATES)
  test(`/ and /versions in the ${state.name} state`, async ({ page }) => {
    stub.scenario = state.scenario;
    app = await startLiveApp(stub);
    for (const route of ["/", "/versions"])
      for (const platform of PLATFORMS) {
        await page.setViewportSize(platform);
        await page.goto(app.url + route);
        await expect(page.locator(state.expect).first()).toBeVisible();
        const where = `${route} (live, ${state.name})`;
        expect([
          ...(await pageChecks(page, where)),
          ...(await onePrimary(page, where)),
        ]).toEqual([]);
      }
  });
