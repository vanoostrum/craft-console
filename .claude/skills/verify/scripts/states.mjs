// Open the Projects page and the Craft versions page on CONSOLE_DATA=live in
// each state, against the synthetic stub from e2e/live-stub.ts, and save each
// app screenshot next to the gallery page of that state. The stub sessions have
// no segments, so /versions shows its empty line in the default state. Needs a built app (`pnpm build`).
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

// Per state: the stub answers, and per page its gallery page and the element it must show once.
const STATES = [
  {
    state: "default",
    scenario: normal,
    pages: [
      { feature: "projects", path: "/", gallery: "default", check: "table" },
      {
        feature: "craft-versions",
        path: "/versions",
        gallery: "empty",
        check: "p.note",
      },
    ],
  },
  {
    state: "empty",
    scenario: scenario([], []),
    pages: [
      {
        feature: "projects",
        path: "/",
        gallery: "empty",
        check: "td.empty-row",
      },
      {
        feature: "craft-versions",
        path: "/versions",
        gallery: "empty",
        check: "p.note",
      },
    ],
  },
  {
    state: "error",
    scenario: { ...normal, listStatus: 403 },
    pages: [
      {
        feature: "projects",
        path: "/",
        gallery: "error",
        check: ".notice.error",
      },
      {
        feature: "craft-versions",
        path: "/versions",
        gallery: "error",
        check: ".notice.error",
      },
    ],
  },
  {
    state: "skipped-files",
    scenario: {
      ...normal,
      pages: [[...normal.pages[0], ...bad]],
      files: { ...normal.files, [bad[0]]: "{", [bad[1]]: '{"repo": 1}' },
    },
    pages: [
      {
        feature: "projects",
        path: "/",
        gallery: "skipped-files",
        check: ".notice[role=status]",
      },
      {
        feature: "craft-versions",
        path: "/versions",
        gallery: "skipped-files",
        check: ".notice[role=status]",
      },
    ],
  },
];

const stub = new LiveStub();
await stub.start();
const browser = await chromium.launch();
const failures = [];
try {
  for (const { state, scenario: answers, pages } of STATES) {
    stub.scenario = answers;
    const app = await startLiveApp(stub);
    try {
      for (const { feature, path, gallery, check } of pages) {
        const dir = join(evidence, `${feature}-${state}`);
        mkdirSync(dir, { recursive: true });
        const log = [];
        for (const [platform, viewport] of Object.entries(PLATFORMS)) {
          const tab = await browser.newPage({ viewport });
          const response = await tab.goto(`${app.url}${path}`);
          log.push(
            `GET ${path} (${state}, ${platform}) -> ${response.status()}`,
          );
          const main = (await tab.locator("main").innerText()).trim();
          log.push(`main text:\n${main}`);
          if ((await tab.locator(check).count()) !== 1)
            failures.push(`${path} ${state} on ${platform}: no ${check}`);
          if (
            (await tab.locator(".read-at").count()) > 0 ||
            main.includes("Read at")
          )
            failures.push(
              `${path} ${state} on ${platform}: has a "Read at" line`,
            );
          const scroll = await tab.evaluate(
            () =>
              document.documentElement.scrollWidth -
              document.documentElement.clientWidth,
          );
          if (scroll > 0)
            failures.push(`${path} ${state} scrolls sideways on ${platform}`);
          await tab.screenshot({
            path: join(dir, `app_${feature}_${state}_${platform}.png`),
            fullPage: true,
          });
          await tab.goto(
            pathToFileURL(resolve(`design/pages/${feature}/${gallery}.html`))
              .href,
          );
          await tab.addStyleTag({ content: FONT_FACES });
          await tab.evaluate(() => document.fonts.ready);
          await tab.screenshot({
            path: join(dir, `gallery_${feature}_${gallery}_${platform}.png`),
            fullPage: true,
          });
          await tab.close();
        }
        writeFileSync(join(dir, "transcript.txt"), log.join("\n") + "\n");
        console.log(`== ${feature}-${state}\n${log.join("\n")}`);
      }
    } finally {
      app.stop();
    }
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
