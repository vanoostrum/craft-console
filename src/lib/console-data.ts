// No imports here: `scripts/start.mjs` loads this file with Node's type stripping.

export type DataSource = "fixtures" | "live";

/** Read `CONSOLE_DATA`. Unset or empty means fixtures. Any other unknown value throws. */
export function parseDataSource(value: string | undefined): DataSource {
  if (value === undefined || value === "" || value === "fixtures")
    return "fixtures";
  if (value === "live") return "live";
  throw new Error(
    `CONSOLE_DATA="${value}" is not a data source. Use fixtures or live.`,
  );
}
