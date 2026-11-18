import { z } from "zod";
import type { SessionMetadata } from "./session-metadata";

/**
 * A Linear ticket, as a `TicketReader` returns it. `key` is always the key that
 * was asked for, even when Linear resolves an old key to a ticket with a new key.
 */
export const Ticket = z.object({
  key: z.string(),
  title: z.string(),
  state: z.string(),
  stateType: z.enum([
    "triage",
    "backlog",
    "unstarted",
    "started",
    "completed",
    "canceled",
  ]),
  project: z.string().nullable(),
  milestone: z.string().nullable(),
  parent: z.string().nullable(),
});

export type Ticket = z.infer<typeof Ticket>;

/**
 * What a `SessionReader` reads: every session that parses, and the path of each
 * session file that does not (an unreadable session file).
 */
export type SessionRead = {
  sessions: SessionMetadata[];
  unreadable: string[];
};

export interface SessionReader {
  /** All sessions in the data source. */
  sessions(): Promise<SessionRead>;
}

export interface TicketReader {
  /** The tickets it finds for these keys. A key it does not find is left out, with no error. */
  tickets(keys: readonly string[]): Promise<Ticket[]>;
}

export type Readers = { sessions: SessionReader; tickets: TicketReader };
