import { sessionFiles, ticketFile } from "@/fixtures";
import { z } from "zod";
import { briefOf } from "./brief";
import { Ticket, type Readers } from "./readers";
import { SessionMetadata } from "./session-metadata";

/** A ticket in `src/fixtures/tickets.json`: its description instead of `brief`, as Linear gives it. */
const FixtureTicket = Ticket.omit({ brief: true }).extend({
  description: z.string().nullable(),
});

const sessions = sessionFiles.map((file) => SessionMetadata.parse(file));
const tickets: Ticket[] = FixtureTicket.array()
  .parse(ticketFile)
  .map(({ description, ...ticket }) => ({
    ...ticket,
    brief: briefOf(ticket.title, description),
  }));

export const fixtureReaders: Readers = {
  sessions: {
    async sessions() {
      return sessions;
    },
  },
  tickets: {
    async tickets(keys) {
      const asked = new Set(keys);
      return tickets.filter((ticket) => asked.has(ticket.key));
    },
  },
};
