# CLAUDE.md

**Craft Console** is a dashboard for the craft factory. It shows what craft's work on each project costs and how long it takes.

## Project

| Path                       | What                                                                                                                                                                       |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/`                 | The Next.js App Router pages and routes.                                                                                                                                   |
| `src/lib/`                 | The data layer: `SessionMetadata`, the readers, `CONSOLE_DATA`, and pure functions on what the readers return. Unit tests sit next to the code as `*.test.ts`.             |
| `src/fixtures/`            | The synthetic fixtures. Never copy data from the bucket or Linear: the repository is public.                                                                               |
| `e2e/`                     | Playwright tests over HTTP against the built app. The default place for tests.                                                                                             |
| `tests/design/`            | The design checks (gallery stage 2): WCAG AA contrast, visible elements, no page scroll, one primary action, and the focus outline, over every gallery page and app route. |
| `scripts/start.mjs`        | `pnpm start`: checks `CONSOLE_DATA`, then starts the app.                                                                                                                  |
| `design/`                  | The design gallery: the visual spec of each screen. `design/README.md` has its state; the rules are in the craft plugin.                                                   |
| `docs/adr/`                | Decisions.                                                                                                                                                                 |
| `.github/workflows/ci.yml` | CI: the `checks` and `e2e` jobs.                                                                                                                                           |

- Next.js (App Router, TypeScript), Node 22 (`.nvmrc`), pnpm through corepack (`packageManager`). Add dependencies with `pnpm add`, with an exact version.
- Lint with **ESLint**, format with **Prettier**, type-check with **tsc**, unit-test with **Vitest**, and test pages with **Playwright**. All must pass.
- Write tests first.
- **Test seams.** Test a feature at the highest seam: its page or route over HTTP, with Playwright in `e2e/`. Add a unit test in `src/lib/` only when the HTTP test cannot cover a case well: many input combinations, a case that no request can reach, or a failure that is hard to locate from the page. Do not repeat in a unit test what an HTTP test already checks. Test behavior that a user or client sees, not internals. The design checks in `tests/design/` guard every gallery page and HTML route: a new gallery page is checked with no change, and a new route goes into the route list in `tests/design/app.spec.ts`.
- Vitest reports line and branch coverage on every run. There is no minimum. A branch that no test reaches is a sign that a case needs a test.
- How to run and verify: the `project-verify` skill. To drive the running app: the `verify` skill.
- **pstack.** Load the `craft:bstack` skill before any `pstack:` skill; a hook in the craft plugin blocks pstack skills until bstack is loaded. Where bstack differs from pstack, bstack wins.
- If a skill is unknown, read `.claude/skills/<name>/SKILL.md` and follow it.

## Craft

@.claude/craft.md

Every code change goes through craft. Start with `craft:spec` for a single ticket, or `craft:plan` for bigger work. Never edit code outside a craft step.
