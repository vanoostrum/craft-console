/** What the phase mix bar shows: cost per phase, or craft time per phase. */
export type ShadeBy = "cost" | "time";

/** Read `?shade=`. Only the exact value `time` gives `time`; a repeated parameter uses its first value. */
export function shadeBy(value: string | string[] | undefined): ShadeBy {
  return (Array.isArray(value) ? value[0] : value) === "time" ? "time" : "cost";
}
