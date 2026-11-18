import type { AttributedSegment } from "./attribution";
import { isPlanTitle } from "./brief";
import { PHASES, phaseOf, segmentCost, type Phase } from "./cost";
import type { Ticket } from "./readers";

/** One phase cell: null when no segment has that phase. `workSeconds` is null when none of its segments has time data. */
export type Cell = { cost: number; workSeconds: number | null } | null;

export type Sums = {
  cells: Record<Phase, Cell>;
  cost: number;
  /** Null when no segment of the row has time data. */
  workSeconds: number | null;
  waitSeconds: number | null;
};

export type GridRow =
  | { kind: "plan"; key: string; label: string; sums: Sums; rows: GridRow[] }
  | { kind: "milestone"; label: string; sums: Sums; rows: GridRow[] }
  | { kind: "single"; sums: Sums; rows: GridRow[] }
  | { kind: "ticket"; ticket: Ticket; sums: Sums }
  | { kind: "noTicket"; sums: Sums };

export type ProjectGrid = {
  /** The top rows in display order: plans, Single tickets, and No ticket. */
  rows: GridRow[];
  total: Sums;
  /** The largest phase cell of the ticket rows and the No ticket row, by cost and by craft time. */
  largest: { cost: number; workSeconds: number };
};

/** Raw values per phase, before they become cells. */
type Acc = Record<
  Phase,
  { cost: number; work: number; wait: number; timed: boolean; any: boolean }
>;

const emptyAcc = (): Acc =>
  Object.fromEntries(
    PHASES.map((p) => [
      p,
      { cost: 0, work: 0, wait: 0, timed: false, any: false },
    ]),
  ) as Acc;

function add(acc: Acc, s: AttributedSegment) {
  const a = acc[phaseOf(s.segment.step)];
  a.any = true;
  a.cost += segmentCost(s.segment).eur;
  a.work += s.segment.work_seconds ?? 0;
  a.wait += s.segment.wait_seconds ?? 0;
  if (
    s.segment.work_seconds !== undefined ||
    s.segment.wait_seconds !== undefined
  )
    a.timed = true;
}

function merge(accs: readonly Acc[]): Acc {
  const out = emptyAcc();
  for (const acc of accs)
    for (const p of PHASES) {
      out[p].cost += acc[p].cost;
      out[p].work += acc[p].work;
      out[p].wait += acc[p].wait;
      out[p].timed ||= acc[p].timed;
      out[p].any ||= acc[p].any;
    }
  return out;
}

function sums(acc: Acc): Sums {
  const values = PHASES.map((p) => acc[p]);
  const timed = values.some((a) => a.timed);
  return {
    cells: Object.fromEntries(
      PHASES.map((p) => [
        p,
        acc[p].any
          ? {
              cost: acc[p].cost,
              workSeconds: acc[p].timed ? acc[p].work : null,
            }
          : null,
      ]),
    ) as Record<Phase, Cell>,
    cost: values.reduce((sum, a) => sum + a.cost, 0),
    workSeconds: timed ? values.reduce((sum, a) => sum + a.work, 0) : null,
    waitSeconds: timed ? values.reduce((sum, a) => sum + a.wait, 0) : null,
  };
}

const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Keys sort by team, then by number: `NAP-99` before `NAP-100`. */
export function byKey(a: string, b: string): number {
  const [, at = a, an = ""] = /^(.*)-(\d+)$/.exec(a) ?? [];
  const [, bt = b, bn = ""] = /^(.*)-(\d+)$/.exec(b) ?? [];
  return byText(at, bt) || Number(an) - Number(bn) || byText(a, b);
}

/** The shade step 1 to 5 of a cell value, relative to the largest; null for no value, 0, or no largest. */
export function shadeStep(
  value: number | null,
  largest: number,
): 1 | 2 | 3 | 4 | 5 | null {
  if (value === null || !(value > 0) || !(largest > 0)) return null;
  return Math.min(5, Math.max(1, Math.ceil((5 * value) / largest))) as
    1 | 2 | 3 | 4 | 5;
}

/**
 * The tickets × phases grid of one project, from its attributed segments
 * (`attributedSegments`, filtered to its repository) and every ticket the read
 * found, parents included.
 */
export function projectGrid(
  segments: readonly AttributedSegment[],
  tickets: readonly Ticket[],
): ProjectGrid {
  const known = new Map(tickets.map((t) => [t.key, t]));
  const perTicket = new Map<string, Acc>();
  const noTicket = emptyAcc();
  let anyNoTicket = false;
  for (const s of segments) {
    if (s.ticket !== null && known.has(s.ticket)) {
      const acc = perTicket.get(s.ticket) ?? emptyAcc();
      add(acc, s);
      perTicket.set(s.ticket, acc);
    } else {
      add(noTicket, s);
      anyNoTicket = true;
    }
  }

  const ticketRow = (key: string): GridRow & { kind: "ticket" } => ({
    kind: "ticket",
    ticket: known.get(key)!,
    sums: sums(perTicket.get(key)!),
  });
  const accOf = (rows: readonly GridRow[]): Acc =>
    merge(
      rows.flatMap((row) =>
        row.kind === "ticket"
          ? [perTicket.get(row.ticket.key)!]
          : "rows" in row
            ? [accOf(row.rows)]
            : [],
      ),
    );

  const plans = new Map<string, string[]>();
  const singles: string[] = [];
  for (const key of perTicket.keys()) {
    const ticket = known.get(key)!;
    const parent =
      ticket.parent === null ? undefined : known.get(ticket.parent);
    const plan = isPlanTitle(ticket.title)
      ? key
      : parent && isPlanTitle(parent.title)
        ? parent.key
        : null;
    if (plan === null) singles.push(key);
    else plans.set(plan, [...(plans.get(plan) ?? []), key]);
  }

  const planRows = [...plans].map(([planKey, keys]): GridRow => {
    const head = keys.includes(planKey) ? [ticketRow(planKey)] : [];
    const members = keys.filter((key) => key !== planKey).sort(byKey);
    const milestones = new Map<string, string[]>();
    const loose: string[] = [];
    for (const key of members) {
      const m = known.get(key)!.milestone;
      if (m === null) loose.push(key);
      else milestones.set(m, [...(milestones.get(m) ?? []), key]);
    }
    let rows: GridRow[];
    if (milestones.size < 2) rows = [...head, ...members.map(ticketRow)];
    else {
      const groups = [...milestones]
        .map(([label, ks]): GridRow & { kind: "milestone" } => {
          const inner = ks.map(ticketRow);
          return {
            kind: "milestone",
            label,
            sums: sums(accOf(inner)),
            rows: inner,
          };
        })
        .sort((a, b) => b.sums.cost - a.sums.cost || byText(a.label, b.label));
      rows = [...head, ...loose.map(ticketRow), ...groups];
    }
    return {
      kind: "plan",
      key: planKey,
      label: known.get(planKey)!.title,
      sums: sums(accOf(rows)),
      rows,
    };
  });
  planRows.sort(
    (a, b) =>
      b.sums.cost - a.sums.cost ||
      byText((a as { label: string }).label, (b as { label: string }).label),
  );

  const rows: GridRow[] = [...planRows];
  if (singles.length > 0) {
    const inner = singles.sort(byKey).map(ticketRow);
    rows.push({ kind: "single", sums: sums(accOf(inner)), rows: inner });
  }
  if (anyNoTicket) rows.push({ kind: "noTicket", sums: sums(noTicket) });

  const shaded = [
    ...[...perTicket.values()].map(sums),
    ...(anyNoTicket ? [sums(noTicket)] : []),
  ].flatMap((row) => PHASES.map((p) => row.cells[p]));
  const largest = {
    cost: Math.max(0, ...shaded.map((c) => c?.cost ?? 0)),
    workSeconds: Math.max(0, ...shaded.map((c) => c?.workSeconds ?? 0)),
  };
  return {
    rows,
    total: sums(merge([...perTicket.values(), noTicket])),
    largest,
  };
}
