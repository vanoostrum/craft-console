import { PHASES, phaseOf, segmentCost, type Phase } from "./cost";
import { monthOf, segmentMonth } from "./max-share";
import type { Ticket } from "./readers";
import { NO_REPO, type SessionMetadata } from "./session-metadata";

export type PhaseValues = Record<Phase, number>;

/** One row of the Projects overview: one repository, or the sessions outside a repository. */
export type Project = {
  /** The Linear project of most of its known tickets, the repository, or "No repository". */
  name: string;
  /** `<owner>/<repo>`, or null for the sessions outside a repository. */
  repository: string | null;
  /** How many keys its sessions name that Linear knows. */
  tickets: number;
  /** How many sessions the repository has. */
  sessions: number;
  /** Euros at the price table. */
  cost: number;
  /** Models with tokens that the price table cannot price, sorted. */
  missingModels: string[];
  /** Null when no segment has time data. */
  workSeconds: number | null;
  waitSeconds: number | null;
  phaseCost: PhaseValues;
  phaseWork: PhaseValues;
  /** The cost in the month of `now`, in Europe/Amsterdam. */
  monthCost: number;
};

export const NO_REPOSITORY = "No repository";

/** All ticket keys that the sessions name, each once. */
export function ticketKeys(sessions: readonly SessionMetadata[]): string[] {
  return [...new Set(sessions.flatMap((session) => session.tickets))];
}

const zero = (): PhaseValues =>
  Object.fromEntries(PHASES.map((phase) => [phase, 0])) as PhaseValues;

/** The Linear project of most tickets, the first in alphabetical order on a tie. */
function projectName(tickets: readonly Ticket[]): string | null {
  const counts = new Map<string, number>();
  for (const ticket of tickets)
    if (ticket.project !== null)
      counts.set(ticket.project, (counts.get(ticket.project) ?? 0) + 1);
  const ranked = [...counts].sort(
    ([a, an], [b, bn]) => bn - an || (a < b ? -1 : a > b ? 1 : 0),
  );
  return ranked[0]?.[0] ?? null;
}

const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * The Projects overview rows, in display order: by cost, highest first, then by
 * name, then by repository, and the sessions outside a repository last.
 */
export function projects(
  sessions: readonly SessionMetadata[],
  found: readonly Ticket[],
  now: Date,
): Project[] {
  const tickets = new Map(found.map((ticket) => [ticket.key, ticket]));
  const month = monthOf(now);
  const groups = new Map<string, SessionMetadata[]>();
  for (const session of sessions)
    groups.set(session.repo, [...(groups.get(session.repo) ?? []), session]);

  const rows = [...groups].map(([repo, group]): Project => {
    const keys = new Set(
      group.flatMap((s) => s.tickets).filter((key) => tickets.has(key)),
    );
    const missing = new Set<string>();
    const phaseCost = zero();
    const phaseWork = zero();
    let cost = 0;
    let monthCost = 0;
    let work = 0;
    let wait = 0;
    let timed = false;
    for (const session of group)
      for (const segment of session.segments) {
        const phase = phaseOf(segment.step);
        const c = segmentCost(segment);
        c.missing.forEach((model) => missing.add(model));
        cost += c.eur;
        phaseCost[phase] += c.eur;
        if (segmentMonth(segment, session.uploaded_at) === month)
          monthCost += c.eur;
        if (
          segment.work_seconds !== undefined ||
          segment.wait_seconds !== undefined
        )
          timed = true;
        work += segment.work_seconds ?? 0;
        wait += segment.wait_seconds ?? 0;
        phaseWork[phase] += segment.work_seconds ?? 0;
      }
    const repository = repo === NO_REPO ? null : repo;
    return {
      name:
        repository === null
          ? NO_REPOSITORY
          : (projectName([...keys].map((key) => tickets.get(key)!)) ??
            repository),
      repository,
      tickets: keys.size,
      sessions: group.length,
      cost,
      missingModels: [...missing].sort(),
      workSeconds: timed ? work : null,
      waitSeconds: timed ? wait : null,
      phaseCost,
      phaseWork,
      monthCost,
    };
  });
  const named = rows
    .filter((row) => row.repository !== null)
    .sort(
      (a, b) =>
        b.cost - a.cost ||
        byText(a.name, b.name) ||
        byText(a.repository!, b.repository!),
    );
  return [...named, ...rows.filter((row) => row.repository === null)];
}
