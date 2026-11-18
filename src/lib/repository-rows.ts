import type { Ticket } from "./readers";
import { NO_REPO, type SessionMetadata } from "./session-metadata";

/** One row of the Projects page. `repository` is null for the No repository row. */
export type RepositoryRow = {
  repository: string | null;
  sessions: number;
  tickets: number;
};

/** All ticket keys that the sessions name, each once. */
export function ticketKeys(sessions: readonly SessionMetadata[]): string[] {
  return [...new Set(sessions.flatMap((session) => session.tickets))];
}

/**
 * One row per repository, sorted by session count (highest first), then by name,
 * and the sessions outside a repository in one last row. A ticket counts once per
 * repository, and only when it is in `found`.
 */
export function repositoryRows(
  sessions: readonly SessionMetadata[],
  found: readonly Ticket[],
): RepositoryRow[] {
  const known = new Set(found.map((ticket) => ticket.key));
  const groups = new Map<string, { sessions: number; tickets: Set<string> }>();
  for (const session of sessions) {
    const group = groups.get(session.repo) ?? {
      sessions: 0,
      tickets: new Set<string>(),
    };
    group.sessions += 1;
    for (const key of session.tickets)
      if (known.has(key)) group.tickets.add(key);
    groups.set(session.repo, group);
  }
  const rows = [...groups].map(([repo, group]) => ({
    repository: repo === NO_REPO ? null : repo,
    sessions: group.sessions,
    tickets: group.tickets.size,
  }));
  const repositories = rows
    .filter((row) => row.repository !== null)
    .sort(
      (a, b) =>
        b.sessions - a.sessions || a.repository!.localeCompare(b.repository!),
    );
  return [...repositories, ...rows.filter((row) => row.repository === null)];
}
