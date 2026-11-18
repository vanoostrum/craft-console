# Projects on real live data (the live step)

Opens the Projects page once against the real transcript bucket and Linear, and checks its numbers. Then it opens `/versions` once, and reports its rows or its notice, with no check against the bucket.

Recipe: `$V live`, in a Claude cloud session. It needs a built app. It starts a fresh app on `CONSOLE_DATA=live` with `NODE_USE_ENV_PROXY=1`, so its first request makes a fresh read through the proxy, which adds the credentials. It lists the session files with `gcloud storage ls` right before and right after that request. For each repository:

- the expected session count is the number of listed `metadata.json` files, minus the paths in the page's skipped-files notice;
- the expected ticket count is the number of distinct keys in those sessions that the Linear API finds, asked one key at a time.

It prints each page count next to its expected counts from the listing before and after, and passes when each page count lies between them. Evidence: `projects-live/transcript.txt`, `app_projects-live_desktop.png`, and `app_craft-versions-live_desktop.png`. They hold real data: do not commit them or paste them into a PR.
