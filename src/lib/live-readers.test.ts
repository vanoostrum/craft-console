import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LiveStub, ticket } from "../../e2e/live-stub";
import { liveReaders } from "./live-readers";

// The Projects page shows only ticket counts, so no request reaches the ticket
// fields yet. This checks each field that the live TicketReader returns.

const stub = new LiveStub();
beforeAll(() => stub.start());
afterAll(() => stub.stop());

describe("live TicketReader", () => {
  it("returns each field from Linear, with the key asked for", async () => {
    stub.scenario = {
      pages: [[]],
      files: {},
      tickets: {
        "OLD-7": {
          identifier: "NEW-7",
          title: "Synthetic title",
          state: { name: "In Review", type: "started" },
          project: { name: "Synthetic project" },
          projectMilestone: { name: "Synthetic milestone" },
          parent: { identifier: "NEW-1" },
        },
        "NEW-8": ticket("NEW-8"),
      },
    };
    const readers = liveReaders({
      CONSOLE_LINEAR_URL: stub.url,
      CONSOLE_GCS_URL: stub.url,
    });
    expect(await readers.tickets.tickets(["OLD-7", "NEW-8"])).toEqual([
      {
        key: "OLD-7",
        title: "Synthetic title",
        state: "In Review",
        stateType: "started",
        project: "Synthetic project",
        milestone: "Synthetic milestone",
        parent: "NEW-1",
      },
      {
        key: "NEW-8",
        title: "Synthetic ticket NEW-8",
        state: "Done",
        stateType: "completed",
        project: "Synthetic project",
        milestone: null,
        parent: null,
      },
    ]);
  });
});
