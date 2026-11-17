// No imports here: `scripts/start.mjs` loads this file with Node's type stripping.

export type DataSource = "fixtures" | "live";

export const LIVE_NOT_AVAILABLE =
  "CONSOLE_DATA=live is not available yet: live data comes with the Live data ticket (CRAFT-63).";

/** Read `CONSOLE_DATA`. Unset or empty means fixtures. Any other unknown value throws. */
export function parseDataSource(value: string | undefined): DataSource {
  if (value === undefined || value === "" || value === "fixtures")
    return "fixtures";
  if (value === "live") return "live";
  throw new Error(
    `CONSOLE_DATA="${value}" is not a data source. Use fixtures or live.`,
  );
}

/** The data source the app can serve now. Throws for a wrong value, and for live until CRAFT-63. */
export function usableDataSource(value: string | undefined): "fixtures" {
  const source = parseDataSource(value);
  if (source === "live") throw new Error(LIVE_NOT_AVAILABLE);
  return source;
}
