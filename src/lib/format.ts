const euro = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** A cost, as `€1,234.50`. */
export function formatEuro(eur: number): string {
  return `€${euro.format(eur)}`;
}

/** The Max plan price: whole euros as `€93`, else with cents, as `€93.50`. */
export function formatPlanPrice(eur: number): string {
  return Number.isInteger(eur) ? `€${eur}` : formatEuro(eur);
}

/**
 * A duration, rounded to the nearest minute first: under 1h `27m`, under 10h
 * `5h02m`, from 10h whole hours rounded down, `196h`.
 */
export function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours >= 10) return `${hours}h`;
  return `${hours}h${String(minutes % 60).padStart(2, "0")}m`;
}
