import { cachedRead, type Cached } from "./cached-read";
import { parseDataSource } from "./console-data";
import { fixtureReaders } from "./fixture-readers";
import { liveReaders } from "./live-readers";
import type { Readers, Ticket } from "./readers";
import { ticketKeys } from "./projects";
import type { SessionMetadata } from "./session-metadata";

/**
 * The readers for `CONSOLE_DATA`. The start check in `scripts/start.mjs` checks
 * the same value, so a wrong value never shows fixture data.
 */
export function selectReaders(
  value: string | undefined,
  env: Record<string, string | undefined> = process.env,
): Readers {
  return parseDataSource(value) === "live" ? liveReaders(env) : fixtureReaders;
}

/** One read of the data source: the sessions, the unreadable session files, and the tickets they name. */
export type ProjectsRead = {
  sessions: SessionMetadata[];
  unreadable: string[];
  tickets: Ticket[];
};

/** Read the bucket, then the tickets its sessions name in Linear, as one result. */
export async function readProjects(readers: Readers): Promise<ProjectsRead> {
  const { sessions, unreadable } = await readers.sessions.sessions();
  const tickets = await readers.tickets.tickets(ticketKeys(sessions));
  return { sessions, unreadable, tickets };
}

let projects: (() => Promise<Cached<ProjectsRead>>) | undefined;

/** The read for the Projects page, kept for 5 minutes. A failed read throws a `ReadError` and is not kept. */
export function projectsRead(): Promise<Cached<ProjectsRead>> {
  projects ??= cachedRead(() =>
    readProjects(selectReaders(process.env.CONSOLE_DATA)),
  );
  return projects();
}
