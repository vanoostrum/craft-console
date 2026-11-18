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

/** The default monthly price of the owner's Max plan: Max 100 is $100, read 2026-11-18. */
export const DEFAULT_MAX_PLAN_EUR = 93;

/**
 * Read `CONSOLE_MAX_PLAN_EUR`: the monthly Max plan price in euros. Unset or
 * empty means the default. Anything but a plain positive number, such as `93`
 * or `93.50`, throws.
 */
export function parseMaxPlanEur(value: string | undefined): number {
  if (value === undefined || value === "") return DEFAULT_MAX_PLAN_EUR;
  const eur = /^\d+(\.\d+)?$/.test(value) ? Number(value) : NaN;
  if (!(eur > 0))
    throw new Error(
      `CONSOLE_MAX_PLAN_EUR="${value}" is not a positive number of euros, such as 93 or 93.50.`,
    );
  return eur;
}

/**
 * The current time. With the fixtures, `CONSOLE_NOW` (an ISO time) fixes it, so
 * the tests have a stable current month. A wrong `CONSOLE_NOW` throws.
 * Live data always uses the real clock.
 */
export function consoleNow(
  source: DataSource,
  value: string | undefined,
): Date {
  if (source !== "fixtures" || value === undefined || value === "")
    return new Date();
  const now = new Date(value);
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(
      value,
    ) ||
    Number.isNaN(now.getTime())
  )
    throw new Error(
      `CONSOLE_NOW="${value}" is not an ISO time, such as 2026-11-22T12:00:00Z.`,
    );
  return now;
}

/** The settings of `process.env` that the pages read. Throws on the first wrong value. */
export function consoleSettings(env: Record<string, string | undefined>): {
  source: DataSource;
  maxPlanEur: number;
  now: Date;
} {
  const source = parseDataSource(env.CONSOLE_DATA);
  return {
    source,
    maxPlanEur: parseMaxPlanEur(env.CONSOLE_MAX_PLAN_EUR),
    now: consoleNow(source, env.CONSOLE_NOW),
  };
}
