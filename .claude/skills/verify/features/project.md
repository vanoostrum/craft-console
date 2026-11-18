# Project page (`/projects/<owner>/<repo>`)

The page of one project: the four tiles (Cost, Craft time, Waiting on you, Max share), and the tickets × phases grid by plan, milestone, and ticket, with Single tickets, No ticket, and Total. Every plan, milestone, and Single tickets row has a fold button; every group is open on load. The Shade by switch shades the ticket and No ticket cells by cost (no `shade`) or by craft time (`?shade=time`). `/projects/no-repo` is the page of the sessions outside a repository. A repository with no sessions gives a 404 page.

Gallery pages, with the fixtures and `CONSOLE_NOW=2026-11-22T12:00:00Z` (which `launch` sets):

| Feature                 | Path                                       | Gallery page                              |
| ----------------------- | ------------------------------------------ | ----------------------------------------- |
| `project`               | `/projects/vanoostrum/nap-time`            | `design/pages/project/default.html`       |
| `project-time`          | `/projects/vanoostrum/nap-time?shade=time` | `design/pages/project/time.html`          |
| `project-no-repository` | `/projects/no-repo`                        | `design/pages/project/no-repository.html` |
| `project-not-found`     | `/projects/vanoostrum/unknown` (HTTP 404)  | `design/pages/project/not-found.html`     |

The app differs from the gallery pages in three ways: the rows and numbers come from the fixtures, every group is open on load (the gallery draws two folded groups), and the switch is two links instead of buttons.

Recipe: `$V drive`. For each path at desktop and phone width it checks the HTTP status, the current tab, and that the page does not scroll sideways. On the project pages it checks that the Total row and the tiles equal the project's overview row, which it works out from `src/fixtures/` with the brief move, and on NapTime that the grid rows come in the grouping order. A difference is a failure. Evidence: `<feature>/transcript.txt`, `app_<feature>_<platform>.png`, `gallery_<feature>_<platform>.png`.

To check folding by hand: open `/projects/vanoostrum/nap-time`, click "Fold Sample app v1: Reports", then "Fold Plan: Sample app v1", then "Open Plan: Sample app v1". The Reports milestone is still folded, and Total does not change. A reload opens every group. `e2e/project.spec.ts` checks the same.
