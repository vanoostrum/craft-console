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

`CONSOLE_DATA` picks the data source. Unset, empty, or `fixtures` reads the fixtures in `src/fixtures/`. `live` comes with the Live data ticket.

## Checks

The `project-verify` skill in `.claude/skills/` lists the commands that CI runs.
