---
name: project-verify
description: How to install, lint, format-check, type-check, test, and build Craft Console, as the `checks` CI job does. Use before every commit, and to reproduce a red `checks` job.
---

# project-verify

All commands run from the repository root. Node 22 and pnpm come through corepack (`corepack enable` once, if `pnpm` is missing). The cloud image already has both.

## Verify (same as the `checks` CI job)

Run all six, in this order. All must pass.

```bash
pnpm install --frozen-lockfile
pnpm lint            # ESLint with the Next.js config
pnpm format:check    # Prettier
pnpm typecheck       # tsc --noEmit
pnpm test            # Vitest with v8 coverage
pnpm build           # next build
```

Fix formatting with `pnpm format`.

## End-to-end tests (the `e2e` CI job)

`pnpm e2e` runs two Playwright projects against the built app: `e2e` (the tests in `e2e/`) and `design` (the design checks in `tests/design/`). `playwright.config.ts` starts it with `pnpm start`, `CONSOLE_DATA=fixtures`, and `CONSOLE_NOW=2026-11-22T12:00:00Z` on port 3000, or reuses a server that already runs there.

```bash
pnpm build && pnpm e2e
pnpm exec playwright test --project=design   # only the design checks
```

The design checks open every page in `design/pages/`, `design/components/`, and `design/patterns/` from `file://`, and every HTML route of the app, at 1280×800 and 390×844. They check WCAG AA contrast with `@axe-core/playwright` (`color-contrast` only), that text, links, and buttons are visible, that no page scrolls sideways, that a page has at most one `.primary` and it stands out, the shade step colours, and the keyboard focus outline. `tests/design/failures.spec.ts` proves each check fails on a synthetic page. A failure names the page or route, the width, the element, and the measured values. If a gallery page fails, do not weaken the check: the fix goes to `craft:design`.

They save a screenshot of each page at desktop and phone width in `screenshots/`. `@playwright/test` is pinned to 1.63.0, the version whose Chromium is in the cloud image. Do not bump it without checking the image.

## Notes

- `pnpm test` prints line and branch coverage for `src/lib/`. There is no minimum. A line or branch under `Uncovered` needs a test, or a reason in the PR.
- Follow the test seam rule in `CLAUDE.md`: pages and routes are tested over HTTP in `e2e/`, the design checks are in `tests/design/`; unit tests in `src/lib/*.test.ts` only where the rule allows them.
- `CONSOLE_DATA` picks the data source: unset, empty, or `fixtures` reads the fixtures in `src/fixtures/`; `live` reads the transcript bucket and Linear. `pnpm start` checks the value before the server starts.
- `e2e/live.spec.ts` tests live data against a local stub of the bucket and Linear (`e2e/live-stub.ts`), with synthetic answers. Each test starts its own app on a free port, with every credential blank and an empty `HOME`, so no test calls the bucket or Linear, and no credential of your machine reaches the stub.
- `CONSOLE_MAX_PLAN_EUR` (default €93) and `CONSOLE_NOW` (fixtures only) are checked by `pnpm start` too. A server you start yourself for `pnpm e2e` needs `CONSOLE_NOW=2026-11-22T12:00:00Z`, as the `e2e` CI job sets.
- Add dependencies with `pnpm add <pkg>` (or `pnpm add -D <pkg>`), pin an exact version, and commit `pnpm-lock.yaml`.
