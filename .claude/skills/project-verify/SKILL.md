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

The Playwright tests in `e2e/` run against the built app. `playwright.config.ts` starts it with `pnpm start`, `CONSOLE_DATA=fixtures`, and `CONSOLE_NOW=2026-11-22T12:00:00Z` on port 3000, or reuses a server that already runs there.

```bash
pnpm build && pnpm e2e
```

They save a screenshot of each page at desktop and phone width in `screenshots/`. `@playwright/test` is pinned to 1.63.0, the version whose Chromium is in the cloud image. Do not bump it without checking the image.

## Notes

- `pnpm test` prints line and branch coverage for `src/lib/`. There is no minimum. A line or branch under `Uncovered` needs a test, or a reason in the PR.
- Follow the test seam rule in `CLAUDE.md`: pages and routes are tested over HTTP in `e2e/`; unit tests in `src/lib/*.test.ts` only where the rule allows them.
- `CONSOLE_DATA` picks the data source: unset, empty, or `fixtures` reads the fixtures in `src/fixtures/`; `live` stops the app until the Live data ticket (CRAFT-63). `pnpm start` checks it before the server starts.
- `CONSOLE_MAX_PLAN_EUR` (default €93) and `CONSOLE_NOW` (fixtures only) are checked by `pnpm start` too. A server you start yourself for `pnpm e2e` needs `CONSOLE_NOW=2026-11-22T12:00:00Z`, as the `e2e` CI job sets.
- Add dependencies with `pnpm add <pkg>` (or `pnpm add -D <pkg>`), pin an exact version, and commit `pnpm-lock.yaml`.
