# Craft versions (`/versions` and `/versions?shade=time`)

For each craft version, the average cost and craft time per phase per ticket, over all projects, newest first, with "Unknown version" last. The two totals have a change line against the next older version.

| Path                   | Gallery page                               |
| ---------------------- | ------------------------------------------ |
| `/versions`            | `design/pages/craft-versions/default.html` |
| `/versions?shade=time` | `design/pages/craft-versions/time.html`    |

The rows and numbers come from `src/fixtures/`, not from the gallery page, so compare the layout, copy, and look. With the fixtures, the 2.8.2 "cost a ticket" ends with ` *`, and the missing-model note shows under the note; the gallery does not draw that case.

Recipe: `$V drive`. It opens both paths at desktop and phone width, checks the current tab, the current Shade by link, that the page does not scroll sideways and has no "Read at" line, that the versions are newest first by a numeric compare with "Unknown version" last, that the Unknown version row has no shade class, and that no cell shows `NaN`. It logs each row with its shade classes. Evidence: `craft-versions/` and `craft-versions-time/`, each with `transcript.txt`, `app_<feature>_<platform>.png`, and `gallery_<feature>_<platform>.png`.

The empty, error, and skipped-files states (`design/pages/craft-versions/empty.html`, `error.html`, `skipped-files.html`) are driven by `states.mjs`: see `features/projects-states.md`.
