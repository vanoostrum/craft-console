---
name: verify
description: Build, start, and drive Craft Console with fixtures, check the Projects numbers against the fixture totals, and save screenshots of each page at desktop and phone width next to the gallery page. Use to prove a change in the running app, not just in tests. For lint, type check, and tests, use project-verify.
---

# Verify Craft Console in the running app

Craft Console is a Next.js app. Its entry points are its pages and routes. This skill builds and starts it with `CONSOLE_DATA=fixtures`, waits for `/api/health`, opens each page in Chromium, and saves evidence. There is no login to turn off: Vercel Authentication guards the deployments, not the app.

All commands run from the repository root:

```bash
export CONSOLE_VERIFY_RUN=$(date +%Y%m%d-%H%M%S)
V=.claude/skills/verify/scripts/console-verify
$V launch    # install, build, start with fixtures on a free port, wait for /api/health
$V drive     # open each page, check the numbers, save screenshots
$V cleanup   # stop the app
```

- `launch` prints `ready: <url> run=<id>`, or the server log and a non-zero exit when `/api/health` does not answer `ok` in 60 seconds. Set `CONSOLE_VERIFY_PORT` to pick the port. State and logs go to `.verify/<run id>/`, which git ignores.
- `drive` prints a transcript per page and ends with `PASS` or `FAIL` and the reasons. It fails when a page does not answer 200, when a page scrolls sideways, or when the Projects rows differ from the totals it computes from `src/fixtures/`.
- Evidence goes to `.verify/<run id>/evidence/<feature>/`: `transcript.txt`, and for each platform in `design/README.md` (desktop 1280×800, mobile 390×844) `app_<feature>_<platform>.png` and `gallery_<feature>_<platform>.png`. Compare each app screenshot with its gallery screenshot.
- Chromium comes from `@playwright/test` 1.63.0, the version in the cloud image.

## Feature map

One file per entry point in `features/`, with its recipe:

| Feature                        | File                         | State                                    |
| ------------------------------ | ---------------------------- | ---------------------------------------- |
| Projects `/`                   | `features/projects.md`       | driven                                   |
| Craft versions `/versions`     | `features/craft-versions.md` | driven                                   |
| Health `/api/health`           | `features/health.md`         | driven by `launch`                       |
| Project page                   | —                            | added by the ticket that builds the page |
| "Shade by" on the project page | —                            | added by the ticket that builds the page |
| A level folded open            | —                            | added by the ticket that builds the page |

The live step (open Projects once on `CONSOLE_DATA=live`) comes with the Live data ticket (CRAFT-63).
