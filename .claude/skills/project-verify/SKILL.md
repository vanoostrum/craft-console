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

The Playwright tests in `e2e/` run against the built app. `playwright.config.ts` starts it with `pnpm start` and `CONSOLE_DATA=fixtures` on port 3000, or reuses a server that already runs there.

```bash
pnpm build && pnpm e2e
```

They save a screenshot of each page at desktop and phone width in `screenshots/`. `@playwright/test` is pinned to 1.63.0, the version whose Chromium is in the cloud image. Do not bump it without checking the image.

## Notes

- `pnpm test` prints line and branch coverage for `src/lib/`. There is no minimum. A line or branch under `Uncovered` needs a test, or a reason in the PR.
- Follow the test seam rule in `CLAUDE.md`: pages and routes are tested over HTTP in `e2e/`; unit tests in `src/lib/*.test.ts` only where the rule allows them.
- `CONSOLE_DATA` picks the data source: unset, empty, or `fixtures` reads the fixtures in `src/fixtures/`; `live` reads the transcript bucket and Linear. `pnpm start` checks the value before the server starts.
- `e2e/live.spec.ts` tests live data against a local stub of the bucket and Linear (`e2e/live-stub.ts`), with synthetic answers. Each test starts its own app on a free port, with every credential blank and an empty `HOME`, so no test calls the bucket or Linear, and no credential of your machine reaches the stub.
- Add dependencies with `pnpm add <pkg>` (or `pnpm add -D <pkg>`), pin an exact version, and commit `pnpm-lock.yaml`.
