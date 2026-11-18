# craft-console

Console for the Craft factory: a dashboard of what craft's work on each project costs and how long it takes.

## Run it locally

Needs Node 22.18 or later (see `.nvmrc` and `engines`) and corepack, which brings the pinned pnpm.

```bash
corepack enable
pnpm install
pnpm dev
```

The app starts on http://localhost:3000. `http://localhost:3000/api/health` returns `ok`, and `/` shows the fixture rows.

`CONSOLE_DATA` picks the data source. Unset, empty, or `fixtures` reads the fixtures in `src/fixtures/`. `live` reads the transcript bucket `gs://craft-transcripts` and Linear. The app keeps each read for 5 minutes.

## Live data

Each environment gets its credentials in its own way:

| Where                  | Transcript bucket                                                                                                                                                                            | Linear                                               |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Your Mac               | Run `gcloud auth application-default login` once. The app finds the ADC file at `~/.config/gcloud/application_default_credentials.json`, or at the path in `GOOGLE_APPLICATION_CREDENTIALS`. | `LINEAR_API_KEY=<personal API key>` in `.env.local`. |
| A Claude cloud session | None. The proxy adds them. Start the app with `NODE_USE_ENV_PROXY=1`, so Node's `fetch` goes through the proxy.                                                                              | None. The proxy adds them.                           |
| Vercel Production      | `GCS_CREDENTIALS_JSON`: the JSON key of a service account with only `roles/storage.objectViewer` on the bucket.                                                                              | `LINEAR_API_KEY`                                     |

On your Mac, `.env.local` holds:

```bash
CONSOLE_DATA=live
LINEAR_API_KEY=lin_api_...
```

Then run `pnpm build && pnpm start`, or `pnpm dev`. An empty value counts as not set. The bucket reader uses `GCS_CREDENTIALS_JSON` first, then an ADC file, then no credentials. When a read fails, each page says which source failed and why.

Production reads live data once `CONSOLE_DATA=live` is set in Vercel for Production. Previews and CI stay on fixtures.

`CONSOLE_MAX_PLAN_EUR` is the monthly price of the owner's Max plan in euros, for the Max share. Unset or empty means €93 (Max 100). `CONSOLE_NOW` fixes the current time with the fixtures, as an ISO time such as `2026-11-22T12:00:00Z`, so the tests have a stable current month. `pnpm start` stops with a message for a wrong value of either.

## Checks

The `project-verify` skill in `.claude/skills/` lists the commands that CI runs.
