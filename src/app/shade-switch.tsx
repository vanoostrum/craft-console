import Link from "next/link";
import type { ShadeBy } from "@/lib/shade";

/** A link to `path` that keeps the craft time shading: `?shade=time` only when the page shows craft time. */
export const withShade = (path: string, shade: ShadeBy) =>
  shade === "time" ? `${path}?shade=time` : path;

/** The Shade by switch: two links to the same page, by cost and by craft time. */
export function ShadeSwitch({
  path,
  current,
}: {
  path: string;
  current: ShadeBy;
}) {
  return (
    <>
      <span className="label" id="shade-label">
        Shade by
      </span>
      <div className="toggle" role="group" aria-labelledby="shade-label">
        <Link
          href={path}
          aria-current={current === "cost" ? "true" : undefined}
        >
          € cost
        </Link>
        <Link
          href={withShade(path, "time")}
          aria-current={current === "time" ? "true" : undefined}
        >
          craft time
        </Link>
      </div>
    </>
  );
}
