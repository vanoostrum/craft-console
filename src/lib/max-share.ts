/** The calendar months of the Max share are months in this time zone. */
export const MAX_SHARE_TIME_ZONE = "Europe/Amsterdam";

const parts = new Intl.DateTimeFormat("en-CA", {
  timeZone: MAX_SHARE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
});

/** The month of a time in Europe/Amsterdam, as `2026-11`. */
export function monthOf(time: Date): string {
  const p = parts.formatToParts(time);
  const year = p.find((part) => part.type === "year")!.value;
  const month = p.find((part) => part.type === "month")!.value;
  return `${year}-${month}`;
}

/** A segment counts in the month it ended: `ended_at`, else `started_at`, else the session's `uploaded_at`. */
export function segmentMonth(
  segment: { started_at: string | null; ended_at: string | null },
  uploadedAt: string,
): string {
  return monthOf(
    new Date(segment.ended_at ?? segment.started_at ?? uploadedAt),
  );
}

/**
 * Each project's share of the monthly Max price, by its cost in that month.
 * Null for a project with no cost in the month, and for every project when the
 * month has no cost at all.
 */
export function maxShare(
  projects: readonly { monthCost: number }[],
  priceEur: number,
): (number | null)[] {
  const total = projects.reduce((sum, p) => sum + p.monthCost, 0);
  return projects.map((p) =>
    total > 0 && p.monthCost > 0 ? (priceEur * p.monthCost) / total : null,
  );
}
