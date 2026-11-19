// A local stand-in for the GCS JSON API and the Linear GraphQL API, with
// recorded, synthetic answers. The live e2e tests point the app at it with
// CONSOLE_GCS_URL and CONSOLE_LINEAR_URL. Never copy real data here: the
// repository is public.
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const BUCKET_PATH = "/storage/v1/b/craft-transcripts/o";

export type Ticket = {
  identifier: string;
  title: string;
  description: string | null;
  state: { name: string; type: string };
  project: { name: string; url: string } | null;
  projectMilestone: { name: string } | null;
  parent: { identifier: string } | null;
};

export type Scenario = {
  /** The pages of the bucket listing, each a list of object names. */
  pages: string[][];
  /** The body of each object, by name. A number answers with that HTTP status. */
  files: Record<string, string | number>;
  /** The tickets Linear finds, by the key asked for. */
  tickets: Record<string, Ticket>;
  /** Answer every listing request with this HTTP status. */
  listStatus?: number;
  /** Answer every Linear request with this HTTP status. */
  linearStatus?: number;
};

export type SeenRequest = {
  api: "gcs" | "linear";
  path: string;
  authorization: string | undefined;
  /** For Linear: the keys asked for. */
  keys?: string[];
};

/** A stored session. Its segments default to none: no cost and no craft time. */
export function session(
  repo: string,
  id: string,
  tickets: string[],
  segments: unknown[] = [],
) {
  return {
    path: `${repo}/sessions/${id}/metadata.json`,
    body: JSON.stringify({
      repo,
      branch: "main",
      session_id: id,
      tickets,
      segments,
      event: "Stop",
      uploaded_at: "2026-11-01T10:00:00Z",
      some_future_field: true,
    }),
  };
}

export function ticket(identifier: string): Ticket {
  return {
    identifier,
    title: `Synthetic ticket ${identifier}`,
    description: `A synthetic ticket, ${identifier}.`,
    state: { name: "Done", type: "completed" },
    project: {
      name: "Synthetic project",
      url: "https://linear.app/example/project/synthetic",
    },
    projectMilestone: null,
    parent: null,
  };
}

/** A scenario from sessions, all in one listing page, with the transcript files next to them. */
export function scenario(
  sessions: { path: string; body: string }[],
  keys: string[],
): Scenario {
  const names = sessions.flatMap((s) => [
    s.path,
    s.path.replace("metadata.json", "session.jsonl.gz"),
  ]);
  return {
    pages: [names],
    files: Object.fromEntries(sessions.map((s) => [s.path, s.body])),
    tickets: Object.fromEntries(keys.map((key) => [key, ticket(key)])),
  };
}

const STATUS_TEXT: Record<number, string> = {
  403: "Forbidden",
  404: "Not Found",
  500: "Internal Server Error",
};

export class LiveStub {
  scenario: Scenario = { pages: [[]], files: {}, tickets: {} };
  seen: SeenRequest[] = [];
  private server!: Server;

  get url(): string {
    return `http://127.0.0.1:${(this.server.address() as AddressInfo).port}`;
  }

  async start(): Promise<void> {
    this.server = createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        const url = new URL(req.url ?? "/", "http://stub");
        const answer = (status: number, json: unknown) => {
          res.writeHead(status, STATUS_TEXT[status] ?? "OK", {
            "content-type": "application/json",
          });
          res.end(typeof json === "string" ? json : JSON.stringify(json));
        };
        if (url.pathname === "/graphql")
          return this.linear(req.headers.authorization, body, answer);
        this.seen.push({
          api: "gcs",
          path: url.pathname + url.search,
          authorization: req.headers.authorization,
        });
        if (url.pathname === BUCKET_PATH) return this.list(url, answer);
        if (url.pathname.startsWith(BUCKET_PATH + "/")) {
          const name = decodeURIComponent(
            url.pathname.slice(BUCKET_PATH.length + 1),
          );
          const file = this.scenario.files[name];
          if (file === undefined) return answer(404, { error: "not found" });
          if (typeof file === "number") return answer(file, { error: "no" });
          return answer(200, file);
        }
        answer(404, { error: "unknown path" });
      });
    });
    await new Promise<void>((done) => this.server.listen(0, "127.0.0.1", done));
  }

  stop(): Promise<void> {
    return new Promise((done) => this.server.close(() => done()));
  }

  reads(api: "gcs" | "linear"): SeenRequest[] {
    return this.seen.filter((r) => r.api === api);
  }

  private list(url: URL, answer: (status: number, json: unknown) => void) {
    if (this.scenario.listStatus)
      return answer(this.scenario.listStatus, { error: "refused" });
    const index = Number(url.searchParams.get("pageToken") ?? "0");
    const pages = this.scenario.pages;
    answer(200, {
      kind: "storage#objects",
      ...(index + 1 < pages.length ? { nextPageToken: String(index + 1) } : {}),
      ...(pages[index].length
        ? { items: pages[index].map((name) => ({ name })) }
        : {}),
    });
  }

  /** Answers as the real API does: an unknown key gives `data: null` and an error per unknown alias. */
  private linear(
    authorization: string | undefined,
    body: string,
    answer: (status: number, json: unknown) => void,
  ) {
    const { variables } = JSON.parse(body) as {
      variables: Record<string, string>;
    };
    this.seen.push({
      api: "linear",
      path: "/graphql",
      authorization,
      keys: Object.values(variables),
    });
    if (this.scenario.linearStatus)
      return answer(this.scenario.linearStatus, {
        errors: [{ message: "refused" }],
      });
    const missing = Object.entries(variables).filter(
      ([, key]) => !this.scenario.tickets[key],
    );
    if (missing.length)
      return answer(200, {
        errors: missing.map(([alias]) => ({
          message: "Entity not found: Issue",
          path: [alias],
          extensions: { code: "INPUT_ERROR", statusCode: 400 },
        })),
        data: null,
      });
    answer(200, {
      data: Object.fromEntries(
        Object.entries(variables).map(([alias, key]) => [
          alias,
          this.scenario.tickets[key],
        ]),
      ),
    });
  }
}

export type App = { url: string; log: () => string; stop: () => void };

/**
 * Start the built app on CONSOLE_DATA=live against the stub, on a free port,
 * with every credential blank and an empty HOME, so no credential of the
 * machine that runs the tests reaches the stub.
 */
export async function startLiveApp(
  stub: LiveStub,
  env: Record<string, string> = {},
): Promise<App> {
  const port = await freePort();
  const root = resolve(".");
  const child: ChildProcess = spawn("node", ["scripts/start.mjs"], {
    cwd: root,
    detached: true,
    env: {
      PATH: `${join(root, "node_modules/.bin")}:${process.env.PATH}`,
      NODE_ENV: "production",
      CONSOLE_DATA: "live",
      CONSOLE_GCS_URL: stub.url,
      CONSOLE_LINEAR_URL: stub.url,
      LINEAR_API_KEY: "",
      GCS_CREDENTIALS_JSON: "",
      GOOGLE_APPLICATION_CREDENTIALS: "",
      HOME: mkdtempSync(join(tmpdir(), "console-home-")),
      PORT: String(port),
      ...env,
    },
  });
  let log = "";
  child.stdout?.on("data", (chunk) => (log += chunk));
  child.stderr?.on("data", (chunk) => (log += chunk));
  const url = `http://127.0.0.1:${port}`;
  const stop = () => {
    try {
      process.kill(-child.pid!, "SIGTERM");
    } catch {
      // already stopped
    }
  };
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(`${url}/api/health`)).ok)
        return { url, log: () => log, stop };
    } catch {
      // not up yet
    }
    if (child.exitCode !== null) break;
    await new Promise((done) => setTimeout(done, 250));
  }
  stop();
  throw new Error(`the live app did not start:\n${log}`);
}

export function freePort(): Promise<number> {
  return new Promise((done) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      server.close(() => done(port));
    });
  });
}
