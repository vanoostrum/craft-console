# Projects and Craft versions states on live data (`CONSOLE_DATA=live`)

The four states of the Projects page (`/`) and the Craft versions page (`/versions`) on live data, each against the synthetic stub of the bucket and Linear in `e2e/live-stub.ts`:

| State         | Stub answer                                 | Gallery page                               |
| ------------- | ------------------------------------------- | ------------------------------------------ |
| default       | sessions and tickets                        | `design/pages/projects/default.html`       |
| empty         | an empty listing                            | `design/pages/projects/empty.html`         |
| error         | the listing answers 403                     | `design/pages/projects/error.html`         |
| skipped files | two `metadata.json` files that do not parse | `design/pages/projects/skipped-files.html` |

Recipe: `$V drive` runs `states.mjs` after the fixture pages. It needs a built app. For each state it starts a fresh app, opens both pages, saves `app_<page>_<state>_<platform>.png` and `gallery_<page>_<gallery page>_<platform>.png` for desktop and mobile in `<page>-<state>/`, and fails when the state's element is missing, the page shows a "Read at" line, or the page scrolls sideways.

On `/versions`, each state compares with `design/pages/craft-versions/<state>.html`, except the default state: the stub sessions have no segments, so no craft version has finished a ticket, and the page shows the line of `empty.html`. With skipped files, the notice sits above that line, not above a grid.

The stub sessions have no segments, so cost shows `€0.00`, the time columns show `—`, and the phase bars are empty. Compare everything else with the gallery page: the columns, the top bar with Shade by, the notices, the error line, and the empty row.
