// Open each page of the running app, check the Projects numbers against the
// fixture totals, and save screenshots of the app and of the gallery page.
// Usage: node drive.mjs <base url> <evidence dir>
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";
// Node 22.18+ loads the .ts file with its built-in type stripping: the price table is data, not app logic.
import { EUR_PER_USD, PRICES } from "../../../../src/lib/prices.ts";

const [base, evidence] = process.argv.slice(2);
const PLATFORMS = {
  desktop: { width: 1280, height: 800 },
  mobile: { width: 390, height: 844 },
};
const PAGES = [
  {
    feature: "projects",
    path: "/",
    gallery: "design/pages/projects/missing-data.html",
    shade: "cost",
  },
  {
    feature: "projects-time",
    path: "/?shade=time",
    gallery: "design/pages/projects/time.html",
    shade: "time",
  },
  {
    feature: "project",
    path: "/projects/vanoostrum/nap-time",
    gallery: "design/pages/project/default.html",
    project: "vanoostrum/nap-time",
    fold: true,
  },
  {
    feature: "project-time",
    path: "/projects/vanoostrum/nap-time?shade=time",
    gallery: "design/pages/project/time.html",
    project: "vanoostrum/nap-time",
  },
  {
    feature: "project-no-repository",
    path: "/projects/no-repo",
    gallery: "design/pages/project/no-repository.html",
    project: "no-repo",
  },
  {
    feature: "project-not-found",
    path: "/projects/vanoostrum/unknown",
    gallery: "design/pages/project/not-found.html",
    status: 404,
  },
  {
    feature: "craft-versions",
    path: "/versions",
    gallery: "design/pages/craft-versions/default.html",
  },
];

// The month that CONSOLE_NOW (set by `console-verify launch`) falls in, in Europe/Amsterdam.
const NOW_MONTH = "2026-11";
const PLAN_EUR = 93;
const PHASES = ["plan", "spec", "design", "build", "review", "merge", "other"];

const amsterdamMonth = (time) => {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date(time));
  return `${p.find((x) => x.type === "year").value}-${p.find((x) => x.type === "month").value}`;
};
const phase = (step) =>
  /^craft:(plan|spec|design|build|review|merge)$/.test(step ?? "")
    ? step.slice(6)
    : "other";
const euro = (n) =>
  `€${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const duration = (seconds) => {
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m}m`;
  if (m < 600)
    return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}m`;
  return `${Math.floor(m / 60)}h`;
};

/**
 * The rows the fixtures must give, worked out here from the fixture files and
 * the price table, not with the app's own functions: per row the cells, the
 * session count, and the phase bar titles by cost and by craft time.
 */
function expectedRows() {
  const dir = "src/fixtures/sessions";
  const sessions = readdirSync(dir).map((name) =>
    JSON.parse(readFileSync(join(dir, name), "utf8")),
  );
  const known = new Map(
    JSON.parse(readFileSync("src/fixtures/tickets.json", "utf8")).map((t) => [
      t.key,
      t,
    ]),
  );
  const price = (tokens, missing) => {
    let usd = 0;
    for (const [model, u] of Object.entries(tokens)) {
      const counts = [
        u.input_tokens,
        u.output_tokens,
        u.cache_creation_input_tokens,
        u.cache_read_input_tokens,
      ];
      const p = PRICES[model];
      if (!p) {
        if (counts.some(Boolean)) missing.add(model);
        continue;
      }
      const rates = [p.input, p.output, p.cacheWrite, p.cacheRead];
      usd += counts.reduce((sum, n, i) => sum + n * rates[i], 0) / 1e6;
    }
    return usd * EUR_PER_USD;
  };
  // The brief move: a segment whose brief has the document id of a plan
  // ticket's brief link counts in the repository where the plan ticket's
  // segments ran (the fixtures always have them).
  const docId = (url) =>
    /\/document\/(?:.*-)?([0-9a-f]+)(?:[/?#]|$)/.exec(url)?.[1];
  const planOfBrief = new Map();
  for (const t of known.values()) {
    const link = /\[Brief: [^\]]*\]\(<?([^)>]+)>?\)/.exec(t.description ?? "");
    if (t.title.startsWith("Plan: ") && link) {
      const repos = sessions
        .filter((s) => s.segments.some((seg) => seg.ticket === t.key))
        .map((s) => s.repo);
      if (repos.length) planOfBrief.set(docId(link[1]), repos.sort()[0]);
    }
  }
  const repoOf = (s, seg) =>
    (seg.brief && planOfBrief.get(docId(seg.brief))) || s.repo;
  const blank = (repo) => ({
    repo,
    sessions: 0,
    keys: new Set(),
    cost: 0,
    month: 0,
    missing: new Set(),
    work: 0,
    wait: 0,
    timed: false,
    phaseCost: Object.fromEntries(PHASES.map((p) => [p, 0])),
    phaseWork: Object.fromEntries(PHASES.map((p) => [p, 0])),
  });
  const groups = new Map();
  for (const s of sessions) {
    const own = groups.get(s.repo) ?? blank(s.repo);
    own.sessions += 1;
    s.tickets.filter((k) => known.has(k)).forEach((k) => own.keys.add(k));
    groups.set(s.repo, own);
  }
  for (const s of sessions) {
    for (const seg of s.segments) {
      const g = groups.get(repoOf(s, seg));
      let c = price(seg.tokens, g.missing);
      for (const sub of seg.subagents) c += price(sub.tokens, g.missing);
      g.cost += c;
      g.phaseCost[phase(seg.step)] += c;
      if (
        amsterdamMonth(seg.ended_at ?? seg.started_at ?? s.uploaded_at) ===
        NOW_MONTH
      )
        g.month += c;
      if ("work_seconds" in seg || "wait_seconds" in seg) g.timed = true;
      g.work += seg.work_seconds ?? 0;
      g.wait += seg.wait_seconds ?? 0;
      g.phaseWork[phase(seg.step)] += seg.work_seconds ?? 0;
    }
  }
  const nameOf = (g) => {
    if (g.repo === "no-repo") return "No repository";
    const counts = new Map();
    for (const k of g.keys) {
      const project = known.get(k).project;
      if (project) counts.set(project, (counts.get(project) ?? 0) + 1);
    }
    const top = Math.max(0, ...counts.values());
    return (
      [...counts]
        .filter(([, n]) => n === top)
        .map(([p]) => p)
        .sort()[0] ?? g.repo
    );
  };
  const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  const all = [...groups.values()];
  const ordered = [
    ...all
      .filter((g) => g.repo !== "no-repo")
      .sort(
        (a, b) =>
          b.cost - a.cost || cmp(nameOf(a), nameOf(b)) || cmp(a.repo, b.repo),
      ),
    ...all.filter((g) => g.repo === "no-repo"),
  ];
  const monthTotal = ordered.reduce((sum, g) => sum + g.month, 0);
  const title = (values, empty) => {
    const total = PHASES.reduce((sum, p) => sum + values[p], 0);
    if (!(total > 0)) return empty;
    return PHASES.filter((p) => values[p] > 0)
      .map((p) => `${p} ${Math.round((100 * values[p]) / total)}%`)
      .join(", ");
  };
  return ordered.map((g) => {
    const t = g.keys.size;
    const name = nameOf(g);
    return {
      cells: [
        g.repo === "no-repo" ? name : name + g.repo,
        String(t),
        euro(g.cost) + (g.missing.size ? " *" : ""),
        t ? euro(g.cost / t) : "—",
        g.timed ? duration(g.work) : "—",
        g.timed && t ? duration(g.work / t) : "—",
        g.timed ? duration(g.wait) : "—",
        monthTotal > 0 && g.month > 0
          ? `≈ €${Math.round((PLAN_EUR * g.month) / monthTotal)}`
          : "—",
        "",
      ],
      repo: g.repo,
      sessions: String(g.sessions),
      cost: title(g.phaseCost, "no cost"),
      time: title(g.phaseWork, "no craft time"),
    };
  });
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
      if (response.status() !== (page.status ?? 200))
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
      if (page.shade) {
        const readAt = await tab.locator(".read-at").allTextContents();
        log.push(`read time: ${JSON.stringify(readAt)}`);
        if (readAt.length !== 1 || !/^Read at \d\d:\d\d$/.test(readAt[0]))
          failures.push(
            `${page.path} has no "Read at HH:MM" line on ${platform}`,
          );
        const rows = await tab.locator("tbody tr").evaluateAll((trs) =>
          trs.map((tr) => ({
            cells: [...tr.querySelectorAll("td")].map((td) =>
              td.textContent.trim(),
            ),
            sessions: tr.getAttribute("data-sessions"),
            title: tr.querySelector(".mix")?.getAttribute("title"),
          })),
        );
        const expected = expectedRows().map((row) => ({
          cells: row.cells,
          sessions: row.sessions,
          title: row[page.shade],
        }));
        log.push(
          `rows: ${JSON.stringify(rows)}`,
          `fixture totals: ${JSON.stringify(expected)}`,
        );
        if (JSON.stringify(rows) !== JSON.stringify(expected))
          failures.push(
            `${page.path} rows differ from the fixture totals on ${platform}`,
          );
        const current = await tab
          .locator('[aria-labelledby="shade-label"] [aria-current="true"]')
          .allTextContents();
        log.push(`Shade by current: ${JSON.stringify(current)}`);
        if (
          JSON.stringify(current) !==
          JSON.stringify([page.shade === "cost" ? "€ cost" : "craft time"])
        )
          failures.push(`${page.path} has the wrong Shade by link current`);
        // Each project name links to its project page, with the shade choice.
        const links = await tab
          .locator("tbody td.name a")
          .evaluateAll((as) => as.map((a) => a.getAttribute("href")));
        const wantLinks = expectedRows().map(
          (row) =>
            `/projects/${row.repo}` +
            (page.shade === "time" ? "?shade=time" : ""),
        );
        log.push(`project links: ${JSON.stringify(links)}`);
        if (JSON.stringify(links) !== JSON.stringify(wantLinks))
          failures.push(`${page.path} project links differ on ${platform}`);
        if (platform === "desktop") {
          const first = tab.locator("tbody td.name a").first();
          const href = await first.getAttribute("href");
          await first.click();
          await tab.waitForURL((url) => url.pathname + url.search === href);
          const heading = await tab.locator("h1").innerText();
          log.push(
            `click ${JSON.stringify(href)} -> heading ${JSON.stringify(heading)}`,
          );
          if (
            !heading.startsWith(
              expectedRows()[0].cells[0].replace(expectedRows()[0].repo, ""),
            )
          )
            failures.push(
              `${page.path} first project link opens the wrong page`,
            );
          await tab.goto(base + page.path);
        }
        const notes = await tab.locator("p.note").allTextContents();
        log.push(`notes: ${JSON.stringify(notes)}`);
      }
      if (page.fold && platform === "desktop") {
        // Fold a milestone, fold its plan, open the plan: the milestone stays folded.
        const state = async (step) => {
          const visible = await tab.locator("tbody tr:visible").count();
          const expanded = await tab
            .locator("tbody button.fold")
            .evaluateAll((bs) =>
              bs.map(
                (b) =>
                  `${b.getAttribute("aria-label")}=${b.getAttribute("aria-expanded")}`,
              ),
            );
          const total = await tab.locator("tr.total td").nth(8).innerText();
          log.push(
            `fold: ${step}: visible rows ${visible}, Total ${total}, buttons ${JSON.stringify(expanded)}`,
          );
          return { visible, total, expanded };
        };
        const start = await state("on load");
        await tab
          .getByRole("button", {
            name: "Fold Sample app v1: Reports",
            exact: true,
          })
          .click();
        const one = await state("after Fold Sample app v1: Reports");
        await tab
          .getByRole("button", {
            name: "Fold Plan: Sample app v1",
            exact: true,
          })
          .click();
        const two = await state("after Fold Plan: Sample app v1");
        await tab
          .getByRole("button", {
            name: "Open Plan: Sample app v1",
            exact: true,
          })
          .click();
        const three = await state("after Open Plan: Sample app v1");
        await tab.reload();
        const four = await state("after reload");
        const ok =
          start.expanded.every((e) => e.endsWith("=true")) &&
          one.visible === start.visible - 3 &&
          two.visible === start.visible - 11 &&
          three.visible === one.visible &&
          three.expanded.includes("Open Sample app v1: Reports=false") &&
          four.visible === start.visible &&
          four.expanded.every((e) => e.endsWith("=true")) &&
          [one, two, three, four].every((s) => s.total === start.total);
        if (!ok)
          failures.push(`${page.path} folding does not behave as specified`);
      }
      if (page.project) {
        const rows = await tab
          .locator("tbody tr")
          .evaluateAll((trs) =>
            trs.map((tr) =>
              [...tr.querySelectorAll("td")].map((td) =>
                td.innerText.replace(/\s+/g, " ").trim(),
              ),
            ),
          );
        log.push(`grid rows: ${JSON.stringify(rows.map((r) => r[0]))}`);
        const tiles = await tab.locator(".tile .v").allTextContents();
        log.push(`tiles: ${JSON.stringify(tiles)}`);
        const row = expectedRows().find((r) => r.repo === page.project);
        const total = rows.at(-1);
        const want = [
          row.cells[2].replace(" *", ""),
          row.cells[4],
          row.cells[6],
        ];
        log.push(
          `Total: ${JSON.stringify(total.slice(8))}, overview row: ${JSON.stringify(want)}`,
        );
        if (
          total[0] !== "Total" ||
          JSON.stringify(total.slice(8)) !== JSON.stringify(want)
        )
          failures.push(
            `${page.path} Total differs from its overview row on ${platform}`,
          );
        if (
          JSON.stringify(tiles) !==
          JSON.stringify([
            row.cells[2],
            row.cells[4],
            row.cells[6],
            row.cells[7],
          ])
        )
          failures.push(
            `${page.path} tiles differ from its overview row on ${platform}`,
          );
        if (page.project === "vanoostrum/nap-time") {
          const order = rows.map(
            (r) => /^[A-Z]+-\d+/.exec(r[0])?.[0] ?? r[0].split(" ")[0],
          );
          const ORDER = [
            "Plan:",
            "NAP-100",
            "NAP-107",
            "NAP-108",
            "Sample",
            "NAP-104",
            "NAP-105",
            "NAP-106",
            "Sample",
            "NAP-101",
            "NAP-102",
            "NAP-103",
            "Plan:",
            "NAP-109",
            "NAP-110",
            "Single",
            "NAP-111",
            "NAP-112",
            "No",
            "Total",
          ];
          if (JSON.stringify(order) !== JSON.stringify(ORDER))
            failures.push(
              `${page.path} rows are not in the grouping order on ${platform}`,
            );
        }
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
