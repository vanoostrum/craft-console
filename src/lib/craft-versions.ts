import { attributedSegments } from "./attribution";
import { PHASES, phaseOf, segmentCost, type Phase } from "./cost";
import type { Ticket } from "./readers";
import type { SessionMetadata } from "./session-metadata";

type Parts = [number, number, number];

/** "2.9.0" as [2, 9, 0]; null for an unknown version. */
export function parseCraftVersion(
  value: string | null | undefined,
): Parts | null {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value ?? "");
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

/** One phase on one version. Null in `cells`: no ticket had the phase on that version. */
export type VersionCell = {
  cost: number;
  workSeconds: number | null;
  missingModels: string[];
};

/** The change line of one total. Null: no change line. */
export type Change =
  { kind: "change"; percent: number; vs: string } | { kind: "first" } | null;

export type VersionRow = {
  /** The version as `craft_version` gives it; null for the Unknown version row. */
  version: string | null;
  tickets: number;
  cells: Record<Phase, VersionCell | null>;
  /** The sum of the cell costs. */
  cost: number;
  /** The sum of the cell times; null when no ticket on this version has time data. */
  workSeconds: number | null;
  /** The models without a price in this row, sorted. */
  missingModels: string[];
  costChange: Change;
  timeChange: Change;
};

export type CraftVersions = {
  /** Known versions newest first, then the Unknown version row if it has data. */
  rows: VersionRow[];
  /** The largest cell of the known rows; 0 when there is none. */
  largest: { cost: number; workSeconds: number };
};

/** One ticket's work in one phase on one version. */
type TicketWork = {
  cost: number;
  work: number;
  timed: boolean;
  missing: Set<string>;
};

/** Per version (null: unknown), per phase, per ticket key. */
type Work = Map<string | null, Map<Phase, Map<string, TicketWork>>>;

function cell(work: Map<string, TicketWork> | undefined): VersionCell | null {
  if (!work) return null;
  const all = [...work.values()];
  const timed = all.filter((w) => w.timed);
  return {
    cost: all.reduce((sum, w) => sum + w.cost, 0) / all.length,
    workSeconds:
      timed.length > 0
        ? timed.reduce((sum, w) => sum + w.work, 0) / timed.length
        : null,
    missingModels: [...new Set(all.flatMap((w) => [...w.missing]))].sort(),
  };
}

/** The change of `value` against the nearest older row with a value; `first` on the oldest known row. */
function change(
  value: number | null,
  older: readonly VersionRow[],
  of: (row: VersionRow) => number | null,
): Change {
  if (value === null) return null;
  if (older.length === 0) return { kind: "first" };
  const base = older.find((row) => of(row) !== null);
  const was = base ? of(base)! : 0;
  if (!(was > 0)) return null;
  // `|| 0` turns -0 into 0.
  const percent = Math.round((100 * (value - was)) / was) || 0;
  return { kind: "change", percent, vs: base!.version! };
}

/**
 * The Craft versions page: per craft version, the average cost and craft time
 * per phase per ticket, over every project. Only segments of a ticket that
 * Linear knows count, after the brief move of `attributedSegments`.
 */
export function craftVersions(
  sessions: readonly SessionMetadata[],
  tickets: readonly Ticket[],
): CraftVersions {
  const known = new Set(tickets.map((t) => t.key));
  const work: Work = new Map();
  for (const { segment, ticket } of attributedSegments(sessions, tickets)) {
    if (ticket === null || !known.has(ticket)) continue;
    const parts = parseCraftVersion(segment.craft_version);
    const version = parts && parts.join(".");
    const phase = phaseOf(segment.step);
    const phases = work.get(version) ?? new Map();
    work.set(version, phases);
    const perTicket = phases.get(phase) ?? new Map<string, TicketWork>();
    phases.set(phase, perTicket);
    const w = perTicket.get(ticket) ?? {
      cost: 0,
      work: 0,
      timed: false,
      missing: new Set<string>(),
    };
    perTicket.set(ticket, w);
    const cost = segmentCost(segment);
    w.cost += cost.eur;
    w.work += segment.work_seconds ?? 0;
    if (
      segment.work_seconds !== undefined ||
      segment.wait_seconds !== undefined
    )
      w.timed = true;
    for (const model of cost.missing) w.missing.add(model);
  }

  const row = (version: string | null): VersionRow => {
    const phases = work.get(version)!;
    const cells = Object.fromEntries(
      PHASES.map((p) => [p, cell(phases.get(p))]),
    ) as Record<Phase, VersionCell | null>;
    const values = PHASES.flatMap((p) => (cells[p] ? [cells[p]] : []));
    const times = values.flatMap((c) =>
      c.workSeconds === null ? [] : [c.workSeconds],
    );
    return {
      version,
      tickets: new Set([...phases.values()].flatMap((m) => [...m.keys()])).size,
      cells,
      cost: values.reduce((sum, c) => sum + c.cost, 0),
      workSeconds: times.length > 0 ? times.reduce((a, b) => a + b, 0) : null,
      missingModels: [
        ...new Set(values.flatMap((c) => c.missingModels)),
      ].sort(),
      costChange: null,
      timeChange: null,
    };
  };

  const newestFirst = (a: string, b: string) => {
    const [x, y] = [parseCraftVersion(a)!, parseCraftVersion(b)!];
    return y[0] - x[0] || y[1] - x[1] || y[2] - x[2];
  };
  const knownRows = [...work.keys()]
    .filter((v): v is string => v !== null)
    .sort(newestFirst)
    .map(row);
  for (const [i, r] of knownRows.entries()) {
    const older = knownRows.slice(i + 1);
    r.costChange = change(r.cost, older, (o) => o.cost);
    r.timeChange = change(r.workSeconds, older, (o) => o.workSeconds);
  }

  const shaded = knownRows.flatMap((r) =>
    PHASES.flatMap((p) => (r.cells[p] ? [r.cells[p]] : [])),
  );
  return {
    rows: work.has(null) ? [...knownRows, row(null)] : knownRows,
    largest: {
      cost: Math.max(0, ...shaded.map((c) => c.cost)),
      workSeconds: Math.max(0, ...shaded.map((c) => c.workSeconds ?? 0)),
    },
  };
}
