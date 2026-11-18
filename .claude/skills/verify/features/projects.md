# Projects (`/`)

The Projects overview: one row per repository with its tickets, cost, average cost, craft time, average time, waiting on you, Max share for the current month, and a phase mix bar, and No repository last. The Shade by switch in the top bar shades the bar by cost (`/`) or by craft time (`/?shade=time`).

Gallery pages, with the fixtures and `CONSOLE_NOW=2026-11-22T12:00:00Z` (which `launch` sets):

| Feature         | Path           | Gallery page                              |
| --------------- | -------------- | ----------------------------------------- |
| `projects`      | `/`            | `design/pages/projects/missing-data.html` |
| `projects-time` | `/?shade=time` | `design/pages/projects/time.html`         |

`design/pages/projects/default.html` is the layout with all data present. Each project name links to its project page (`features/project.md`). The "Read at" line under the title shows when the app read the fixtures.

Recipe: `$V drive`. It opens both paths at desktop and phone width, checks the current tab, the heading, the current Shade by link, that the page does not scroll sideways, and that it has a "Read at HH:MM" line. It checks that each project name links to its project page, and clicks the first one at desktop width. It compares every cell, each row's `data-sessions`, and each bar's `title` with the values it works out from `src/fixtures/` and the price table in `src/lib/prices.ts`. A difference is a failure. Evidence: `<feature>/transcript.txt`, `app_<feature>_<platform>.png`, `gallery_<feature>_<platform>.png`.
