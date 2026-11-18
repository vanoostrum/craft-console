// The live step: open the Projects page once on CONSOLE_DATA=live, and check
// its numbers against `gcloud storage ls` and the Linear API. Run it in a
// Claude cloud session, where the proxy adds the credentials, with
// NODE_USE_ENV_PROXY=1 so Node's fetch goes through the proxy.
// Usage: node live.mjs <app url> <evidence dir>
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const [base, evidence] = process.argv.slice(2);
const BUCKET = "gs://craft-transcripts/";
const dir = join(evidence, "projects-live");
mkdirSync(dir, { recursive: true });
const log = [];
const say = (line) => {
  log.push(line);
  console.log(line);
};

/** The bucket paths of every metadata.json, without the gs:// prefix. */
function listing() {
  return execFileSync(
    "gcloud",
    ["storage", "ls", "-r", `${BUCKET}**/metadata.json`],
    { encoding: "utf8" },
  )
    .split("\n")
    .filter((line) => line.endsWith("/metadata.json"))
    .map((line) => line.slice(BUCKET.length));
}

const before = listing();
say(
  `gcloud storage ls before the request: ${before.length} metadata.json files`,
);

const browser = await chromium.launch();
const tab = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const response = await tab.goto(base);
say(`GET / -> ${response.status()}`);
const error = await tab.locator("main .notice.error").allTextContents();
const readAt = await tab.locator(".read-at").allTextContents();
const skipped = await tab
  .locator("main .notice[role=status] li")
  .allTextContents();
const rows = await tab
  .locator("tbody tr")
  .evaluateAll((trs) =>
    trs.map((tr) =>
      [...tr.querySelectorAll("td")].map((td) => td.textContent.trim()),
    ),
  );
await tab.screenshot({
  path: join(dir, "app_projects-live_desktop.png"),
  fullPage: true,
});
await browser.close();

const after = listing();
say(`gcloud storage ls after the request: ${after.length} metadata.json files`);
say(`page read time: ${JSON.stringify(readAt)}`);
say(`page skipped files: ${skipped.length}`);
for (const path of skipped) say(`  ${path}`);

const failures = [];
if (error.length) failures.push(`the page shows an error: ${error[0]}`);

// What the files hold: repo and ticket keys, read with gcloud, not with the app.
const sessions = new Map();
for (const path of new Set([...before, ...after])) {
  if (skipped.includes(path)) continue;
  try {
    const json = JSON.parse(
      execFileSync("gcloud", ["storage", "cat", BUCKET + path], {
        encoding: "utf8",
      }),
    );
    sessions.set(path, { repo: json.repo, tickets: json.tickets });
  } catch {
    failures.push(
      `${path} does not parse, but the page does not list it as skipped`,
    );
  }
}

// Which keys the Linear API finds, asked one at a time.
const found = new Map();
async function linearFinds(key) {
  if (!found.has(key)) {
    const answer = await (
      await fetch("https://api.linear.app/graphql", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          query: "query($k: String!) { issue(id: $k) { identifier } }",
          variables: { k: key },
        }),
      })
    ).json();
    const notFound = answer.errors?.some((e) =>
      e.message.startsWith("Entity not found"),
    );
    if (answer.errors && !notFound)
      throw new Error(`Linear API: ${answer.errors[0].message}`);
    found.set(key, !!answer.data?.issue);
  }
  return found.get(key);
}

async function expected(list) {
  const groups = new Map();
  for (const path of list) {
    const session = sessions.get(path);
    if (!session) continue;
    const name = session.repo === "no-repo" ? "No repository" : session.repo;
    const group = groups.get(name) ?? { sessions: 0, tickets: new Set() };
    group.sessions += 1;
    for (const key of session.tickets)
      if (await linearFinds(key)) group.tickets.add(key);
    groups.set(name, group);
  }
  return groups;
}

const low = await expected(before);
const high = await expected(after);
const page = new Map(
  rows.map(([name, s, t]) => [
    name,
    { sessions: Number(s), tickets: Number(t) },
  ]),
);
say("");
say(
  "repository | page sessions | expected (before..after) | page tickets | expected (before..after)",
);
for (const name of new Set([...page.keys(), ...low.keys(), ...high.keys()])) {
  const p = page.get(name) ?? { sessions: 0, tickets: 0 };
  const b = low.get(name) ?? { sessions: 0, tickets: new Set() };
  const a = high.get(name) ?? { sessions: 0, tickets: new Set() };
  const within = (value, x, y) =>
    value >= Math.min(x, y) && value <= Math.max(x, y);
  const sOk = within(p.sessions, b.sessions, a.sessions);
  const tOk = within(p.tickets, b.tickets.size, a.tickets.size);
  say(
    `${name} | ${p.sessions} | ${b.sessions}..${a.sessions} ${sOk ? "ok" : "DIFFERS"} | ${p.tickets} | ${b.tickets.size}..${a.tickets.size} ${tOk ? "ok" : "DIFFERS"}`,
  );
  if (!sOk) failures.push(`${name}: page shows ${p.sessions} sessions`);
  if (!tOk) failures.push(`${name}: page shows ${p.tickets} tickets`);
}
say(
  `Linear API: asked ${found.size} keys one at a time, found ${[...found.values()].filter(Boolean).length}`,
);

writeFileSync(join(dir, "transcript.txt"), log.join("\n") + "\n");
if (failures.length) {
  console.error(`FAIL\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log(`PASS: evidence in ${dir}`);
