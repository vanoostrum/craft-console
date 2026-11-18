import { sameBrief } from "./brief";
import type { Ticket } from "./readers";
import type { Segment, SessionMetadata } from "./session-metadata";

/** A segment with the repository and the ticket key it counts toward. */
export type AttributedSegment = {
  segment: Segment;
  session: SessionMetadata;
  /** The `repo` of the project it counts in: where it ran, or the repository of the plan its brief moved it to. */
  repo: string;
  /** The ticket it counts toward: its own `ticket`, or the plan ticket its brief moved it to. */
  ticket: string | null;
};

const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** The repository with the most of these segments, the first in alphabetical order on a tie. */
function mostSegments(repos: readonly string[]): string | null {
  const counts = new Map<string, number>();
  for (const repo of repos) counts.set(repo, (counts.get(repo) ?? 0) + 1);
  const ranked = [...counts].sort(
    ([a, an], [b, bn]) => bn - an || byText(a, b),
  );
  return ranked[0]?.[0] ?? null;
}

/**
 * Each segment with its repository and its ticket, after the brief move: a
 * segment whose `brief` has the document id of a plan ticket's `brief` counts
 * toward that plan ticket, in the repository of the plan. A plan belongs to the
 * repository of its plan ticket's segments, or, when no segment names the plan
 * ticket, of its tickets' segments. A brief that matches no plan, or a plan with
 * no repository yet, leaves the segment where it ran.
 */
export function attributedSegments(
  sessions: readonly SessionMetadata[],
  tickets: readonly Ticket[],
): AttributedSegment[] {
  const own: AttributedSegment[] = sessions.flatMap((session) =>
    session.segments.map((segment) => ({
      segment,
      session,
      repo: session.repo,
      ticket: segment.ticket,
    })),
  );
  const plans = tickets.filter((ticket) => ticket.brief !== null);
  if (plans.length === 0) return own;
  const parents = new Map(tickets.map((t) => [t.key, t.parent]));
  const planRepo = (key: string) =>
    mostSegments(own.filter((s) => s.ticket === key).map((s) => s.repo)) ??
    mostSegments(
      own
        .filter((s) => s.ticket !== null && parents.get(s.ticket) === key)
        .map((s) => s.repo),
    );
  return own.map((s) => {
    const brief = s.segment.brief ?? null;
    if (brief === null) return s;
    const plan = plans.find((ticket) => sameBrief(ticket.brief, brief));
    const repo = plan && planRepo(plan.key);
    return plan && repo ? { ...s, repo, ticket: plan.key } : s;
  });
}
