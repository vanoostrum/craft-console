import { describe, expect, it } from "vitest";
import { briefId, briefOf, sameBrief } from "./brief";

const DOC =
  "https://linear.app/example/document/brief-sample-app-v1-6c0a3f19e2b4";

describe("briefOf", () => {
  it.each([
    ["the first Brief link", `See [Brief: Sample](${DOC}).`, DOC],
    ["angle brackets", `[Brief: Sample](<${DOC}>)`, DOC],
    [
      "the first of two Brief links",
      `[Brief: A](${DOC}) and [Brief: B](https://linear.app/example/document/brief-b-0d4e5f6a7b8c)`,
      DOC,
    ],
    [
      "a Brief link after a Plan link",
      `[Plan: A](https://linear.app/example/document/plan-a-111111111111) [Brief: A](${DOC})`,
      DOC,
    ],
    ["no Brief link text", `[Sample](${DOC})`, null],
    ["text that only contains Brief:", `[My Brief: A](${DOC})`, null],
    [
      "a Brief link with no /document/",
      "[Brief: A](https://linear.app/example/issue/NAP-1)",
      null,
    ],
    ["no link", "Brief: Sample", null],
    ["a null description", null, null],
  ])("finds %s", (_, description, url) => {
    expect(briefOf("Plan: Sample", description)).toBe(url);
  });

  it.each(["Sample", "plan: Sample", "A Plan: Sample"])(
    "gives null for the title %j, which is not a plan ticket",
    (title) => {
      expect(briefOf(title, `[Brief: Sample](${DOC})`)).toBeNull();
    },
  );
});

describe("briefId", () => {
  it.each([
    [DOC, "6c0a3f19e2b4"],
    [
      "https://linear.app/example/document/brief-sample-app-6c0a3f19e2b4",
      "6c0a3f19e2b4",
    ],
    [`${DOC}#section`, "6c0a3f19e2b4"],
    [`${DOC}?x=1`, "6c0a3f19e2b4"],
    [`${DOC}/`, "6c0a3f19e2b4"],
    ["https://linear.app/example/document/6c0a3f19e2b4", "6c0a3f19e2b4"],
    ["https://linear.app/example/document/brief-sample-app", null],
    ["https://linear.app/example/document/brief-sample-", null],
    ["https://linear.app/example/issue/NAP-1-6c0a3f19e2b4", null],
    ["not a url", null],
  ])("reads %j as %j", (url, id) => {
    expect(briefId(url)).toBe(id);
  });
});

describe("sameBrief", () => {
  it("matches a renamed brief on its document id", () => {
    expect(
      sameBrief(
        "https://linear.app/example/document/brief-sample-app-6c0a3f19e2b4",
        DOC,
      ),
    ).toBe(true);
  });

  it.each([
    [DOC, "https://linear.app/example/document/brief-other-0d4e5f6a7b8c"],
    [DOC, null],
    [null, null],
    [
      "https://linear.app/example/document/brief-sample",
      "https://linear.app/example/document/brief-sample",
    ],
  ])("does not match %j and %j", (a, b) => {
    expect(sameBrief(a, b)).toBe(false);
  });
});
