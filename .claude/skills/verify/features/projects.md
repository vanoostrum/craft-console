# Projects (`/`)

The Projects placeholder: one row per repository with its session and ticket counts, and No repository last. Gallery page: `design/pages/projects/default.html`.

Recipe: `$V drive`. It opens `/` at desktop and phone width, checks the current tab, the heading, and that the page does not scroll sideways, and compares the rows with the totals it computes from `src/fixtures/`. A difference is a failure. Evidence: `projects/transcript.txt`, `app_projects_<platform>.png`, `gallery_projects_<platform>.png`.
