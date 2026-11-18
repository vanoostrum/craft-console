# Projects states on live data (`/` with `CONSOLE_DATA=live`)

The four states of the Projects page on live data, each against the synthetic stub of the bucket and Linear in `e2e/live-stub.ts`:

| State         | Stub answer                                 | Gallery page                                          |
| ------------- | ------------------------------------------- | ----------------------------------------------------- |
| default       | sessions and tickets                        | `design/pages/projects/default.html` ("Read at" line) |
| empty         | an empty listing                            | `design/pages/projects/empty.html`                    |
| error         | the listing answers 403                     | `design/pages/projects/error.html`                    |
| skipped files | two `metadata.json` files that do not parse | `design/pages/projects/skipped-files.html`            |

Recipe: `$V drive` runs `states.mjs` after the fixture pages. It needs a built app. For each state it starts a fresh app, saves `app_projects_<state>_<platform>.png` and `gallery_projects_<state>_<platform>.png` for desktop and mobile in `projects-<state>/`, and fails when the state's element is missing or the page scrolls sideways.

The gallery pages draw these states on the Projects overview of CRAFT-68, and the app still shows the repository list. Compare the "Read at" line, the notices, the error line, and the empty row in copy, place, and style. The table columns differ until CRAFT-68.
