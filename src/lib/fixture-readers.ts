import { sessionFiles, ticketFile } from "@/fixtures";
import { Ticket, type Readers } from "./readers";
import { SessionMetadata } from "./session-metadata";

const sessions = sessionFiles.map((file) => SessionMetadata.parse(file));
const tickets = Ticket.array().parse(ticketFile);

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
