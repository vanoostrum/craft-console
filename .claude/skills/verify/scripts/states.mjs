// Open the Projects page on CONSOLE_DATA=live in each of its states, against
// the synthetic stub from e2e/live-stub.ts, and save each app screenshot next
// to the gallery page of that state. Needs a built app (`pnpm build`).
// Usage: node states.mjs <evidence dir>
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";
import { FONT_FACES } from "./fonts.mjs";
import {
  LiveStub,
  scenario,
  session,
  startLiveApp,
} from "../../../../e2e/live-stub.ts";

const [evidence] = process.argv.slice(2);
const PLATFORMS = {
  desktop: { width: 1280, height: 800 },
  mobile: { width: 390, height: 844 },
};

const sessions = [
  session("vanoostrum/nap-time", "n1", ["NAP-1", "NAP-2"]),
  session("vanoostrum/nap-time", "n2", ["NAP-2"]),
  session("vanoostrum/craft", "c1", ["CRAFT-1"]),
  session("no-repo", "x1", []),
];
const keys = ["NAP-1", "NAP-2", "CRAFT-1"];
const normal = scenario(sessions, keys);
const bad = [
  "vanoostrum/craft/sessions/2f9c41d0-8a7e-5b31-9c04-6d2e8f1a7b55/metadata.json",
  "vanoostrum/nap-time/sessions/a71e09b4-3c2d-5f68-8e1b-04c9d7f25a13/metadata.json",
];

const STATES = [
  { state: "default", scenario: normal, check: ".read-at" },
  { state: "empty", scenario: scenario([], []), check: "td.empty-row" },
  {
    state: "error",
    scenario: { ...normal, listStatus: 403 },
    check: ".notice.error",
  },
  {
    state: "skipped-files",
    scenario: {
      ...normal,
      pages: [[...normal.pages[0], ...bad]],
      files: { ...normal.files, [bad[0]]: "{", [bad[1]]: '{"repo": 1}' },
    },
    check: ".notice[role=status]",
  },
];

const stub = new LiveStub();
await stub.start();
const browser = await chromium.launch();
const failures = [];
try {
  for (const { state, scenario: answers, check } of STATES) {
    const dir = join(evidence, `projects-${state}`);
    mkdirSync(dir, { recursive: true });
    stub.scenario = answers;
    const app = await startLiveApp(stub);
    const log = [];
    try {
      for (const [platform, viewport] of Object.entries(PLATFORMS)) {
        const tab = await browser.newPage({ viewport });
        const response = await tab.goto(app.url);
        log.push(`GET / (${state}, ${platform}) -> ${response.status()}`);
        const main = (await tab.locator("main").innerText()).trim();
        log.push(`main text:\n${main}`);
        if ((await tab.locator(check).count()) !== 1)
          failures.push(`${state} on ${platform}: no ${check}`);
        const scroll = await tab.evaluate(
          () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        );
        if (scroll > 0)
          failures.push(`${state} scrolls sideways on ${platform}`);
        await tab.screenshot({
          path: join(dir, `app_projects_${state}_${platform}.png`),
          fullPage: true,
        });
        await tab.goto(
          pathToFileURL(resolve(`design/pages/projects/${state}.html`)).href,
        );
        await tab.addStyleTag({ content: FONT_FACES });
        await tab.evaluate(() => document.fonts.ready);
        await tab.screenshot({
          path: join(dir, `gallery_projects_${state}_${platform}.png`),
          fullPage: true,
        });
        await tab.close();
      }
    } finally {
      app.stop();
    }
    writeFileSync(join(dir, "transcript.txt"), log.join("\n") + "\n");
    console.log(`== projects-${state}\n${log.join("\n")}`);
  }
} finally {
  await browser.close();
  await stub.stop();
}
if (failures.length) {
  console.error(`FAIL\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log(`PASS: screenshots in ${evidence}`);
