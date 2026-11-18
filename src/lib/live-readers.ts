import { gcsAuth, CredentialError, type Env } from "./gcs-credentials";
import { httpReason, ReadError, readError } from "./read-error";
import { briefOf } from "./brief";
import { Ticket, type Readers, type SessionRead } from "./readers";
import { SessionMetadata } from "./session-metadata";

const BUCKET = "craft-transcripts";
const METADATA = /\/sessions\/[^/]+\/metadata\.json$/;
const FETCHES_AT_ONCE = 10;
const LINEAR_CHUNK = 50;

/** The live readers: the transcript bucket and Linear. Base URLs come from `CONSOLE_GCS_URL` and `CONSOLE_LINEAR_URL`, for tests. */
export function liveReaders(env: Env): Readers {
  return {
    sessions: bucketReader(
      env.CONSOLE_GCS_URL || "https://storage.googleapis.com",
      gcsAuth(env),
    ),
    tickets: linearReader(
      env.CONSOLE_LINEAR_URL || "https://api.linear.app",
      env.LINEAR_API_KEY || undefined,
    ),
  };
}

async function getOk(url: string, headers: Record<string, string>) {
  const response = await fetch(url, { headers, cache: "no-store" });
  if (!response.ok) throw new ReadError("bucket", httpReason(response));
  return response;
}

function bucketReader(
  base: string,
  auth: () => Promise<Record<string, string>>,
): Readers["sessions"] {
  const objects = `${base}/storage/v1/b/${BUCKET}/o`;

  async function list(headers: Record<string, string>): Promise<string[]> {
    const names: string[] = [];
    let pageToken: string | undefined;
    do {
      const query = new URLSearchParams({
        fields: "items(name),nextPageToken",
      });
      if (pageToken) query.set("pageToken", pageToken);
      const page = (await (
        await getOk(`${objects}?${query}`, headers)
      ).json()) as { items?: { name: string }[]; nextPageToken?: string };
      for (const item of page.items ?? [])
        if (METADATA.test(item.name)) names.push(item.name);
      pageToken = page.nextPageToken;
    } while (pageToken);
    return names;
  }

  return {
    async sessions() {
      try {
        const headers = await auth();
        const names = await list(headers);
        const bodies = new Array<string>(names.length);
        let next = 0;
        const worker = async () => {
          while (next < names.length) {
            const index = next++;
            const url = `${objects}/${encodeURIComponent(names[index])}?alt=media`;
            bodies[index] = await (await getOk(url, headers)).text();
          }
        };
        await Promise.all(
          Array.from(
            { length: Math.min(FETCHES_AT_ONCE, names.length) },
            worker,
          ),
        );
        const read: SessionRead = { sessions: [], unreadable: [] };
        names.forEach((name, index) => {
          const session = parseSession(bodies[index]);
          if (session) read.sessions.push(session);
          else read.unreadable.push(name);
        });
        return read;
      } catch (error) {
        if (error instanceof CredentialError)
          throw new ReadError("bucket", error.message);
        throw readError("bucket", error);
      }
    },
  };
}

function parseSession(body: string): SessionMetadata | undefined {
  try {
    const parsed = SessionMetadata.safeParse(JSON.parse(body));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

const ISSUE_FIELDS =
  "title description state { name type } project { name url } projectMilestone { name } parent { identifier }";

type LinearIssue = {
  title: string;
  description: string | null;
  state: { name: string; type: string };
  project: { name: string; url: string } | null;
  projectMilestone: { name: string } | null;
  parent: { identifier: string } | null;
};

type GraphQLAnswer = {
  data?: Record<string, LinearIssue> | null;
  errors?: { message: string; path?: (string | number)[] }[];
};

function linearReader(
  base: string,
  apiKey: string | undefined,
): Readers["tickets"] {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...(apiKey ? { Authorization: apiKey } : {}),
  };

  /** One aliased `issue(id:)` per key. Unknown keys are sent again without, until none is left. */
  async function chunk(keys: string[]): Promise<Ticket[]> {
    let asked = keys;
    while (asked.length) {
      const aliases = asked.map((_, i) => `k${i}`);
      const query = `query(${aliases.map((a) => `$${a}: String!`).join(", ")}) { ${aliases
        .map((a) => `${a}: issue(id: $${a}) { ${ISSUE_FIELDS} }`)
        .join(" ")} }`;
      const response = await fetch(`${base}/graphql`, {
        method: "POST",
        headers,
        cache: "no-store",
        body: JSON.stringify({
          query,
          variables: Object.fromEntries(aliases.map((a, i) => [a, asked[i]])),
        }),
      });
      if (!response.ok) throw new ReadError("linear", httpReason(response));
      const answer = (await response.json()) as GraphQLAnswer;
      const errors = answer.errors ?? [];
      if (errors.length === 0 && answer.data)
        return asked.map((key, i) => toTicket(key, answer.data![aliases[i]]));
      const notFound = new Set<string>();
      for (const error of errors) {
        const alias = error.path?.[0];
        if (
          error.message.startsWith("Entity not found") &&
          typeof alias === "string" &&
          aliases.includes(alias)
        )
          notFound.add(alias);
        else throw new ReadError("linear", error.message);
      }
      if (notFound.size === 0)
        throw new ReadError("linear", "no data in the answer");
      asked = asked.filter((_, i) => !notFound.has(aliases[i]));
    }
    return [];
  }

  return {
    async tickets(keys) {
      try {
        const found: Ticket[] = [];
        for (let i = 0; i < keys.length; i += LINEAR_CHUNK)
          found.push(...(await chunk(keys.slice(i, i + LINEAR_CHUNK))));
        return found;
      } catch (error) {
        throw readError("linear", error);
      }
    },
  };
}

function toTicket(key: string, issue: LinearIssue): Ticket {
  const ticket = Ticket.safeParse({
    key,
    title: issue.title,
    state: issue.state.name,
    stateType: issue.state.type,
    project: issue.project?.name ?? null,
    projectUrl: issue.project?.url ?? null,
    milestone: issue.projectMilestone?.name ?? null,
    parent: issue.parent?.identifier ?? null,
    brief: briefOf(issue.title, issue.description ?? null),
  });
  if (!ticket.success)
    throw new ReadError("linear", `unexpected answer for ${key}`);
  return ticket.data;
}
