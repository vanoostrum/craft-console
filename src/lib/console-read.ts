import type { Readers, Ticket } from "./readers";
import { ticketKeys } from "./projects";
import type { SessionMetadata } from "./session-metadata";

/**
 * The sessions, and the tickets they name with the parents of those tickets.
 * The overview and the project page both read through this, so they see the
 * same tickets. Parents come from a second lookup, because a plan ticket that
 * no session names is not in the first answer.
 */
export async function readConsole(
  readers: Readers,
): Promise<{ sessions: SessionMetadata[]; tickets: Ticket[] }> {
  const sessions = await readers.sessions.sessions();
  const tickets = await readers.tickets.tickets(ticketKeys(sessions));
  const held = new Set(tickets.map((ticket) => ticket.key));
  const parents = [
    ...new Set(
      tickets
        .map((ticket) => ticket.parent)
        .filter((key): key is string => key !== null && !held.has(key)),
    ),
  ];
  const more = parents.length > 0 ? await readers.tickets.tickets(parents) : [];
  return { sessions, tickets: [...tickets, ...more] };
}
