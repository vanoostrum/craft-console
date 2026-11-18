import { generateKeyPairSync } from "node:crypto";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { gcsAuth } from "./gcs-credentials";

// Synthetic credentials only: a key generated here, and a fake refresh token.
const MARKER = "MARKER-7f3a-SECRET";
const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});
const serviceAccount = {
  type: "service_account",
  project_id: "synthetic-project",
  private_key_id: MARKER,
  private_key: privateKey,
  client_email: "reader@synthetic-project.iam.gserviceaccount.com",
  client_id: "1",
  token_uri: "https://oauth2.googleapis.com/token",
};
const authorizedUser = {
  type: "authorized_user",
  client_id: "synthetic-client",
  client_secret: MARKER,
  refresh_token: MARKER,
};

const INVALID_KEY = "GCS_CREDENTIALS_JSON is not a valid service account key";
const ADC_FAILED = "could not load Application Default Credentials";

type Call = { url: string; body: string };

/** A token endpoint that answers each request with `answer`, and records the requests. */
function tokenEndpoint(answer: () => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), body: String(init?.body ?? "") });
    return answer();
  };
  return { calls, fetch: fetch as typeof globalThis.fetch };
}

const token = () =>
  new Response(
    JSON.stringify({
      access_token: "synthetic-token",
      expires_in: 3600,
      token_type: "Bearer",
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );

/** An empty HOME, optionally with the gcloud ADC file in it. */
function home(adc?: string): string {
  const dir = mkdtempSync(join(tmpdir(), "gcs-home-"));
  if (adc !== undefined) {
    mkdirSync(join(dir, ".config/gcloud"), { recursive: true });
    writeFileSync(
      join(dir, ".config/gcloud/application_default_credentials.json"),
      adc,
    );
  }
  return dir;
}

function file(content: string): string {
  const path = join(mkdtempSync(join(tmpdir(), "gcs-file-")), "adc.json");
  writeFileSync(path, content);
  return path;
}

async function failure(promise: Promise<unknown>): Promise<Error> {
  try {
    await promise;
  } catch (error) {
    return error as Error;
  }
  throw new Error("expected a failure");
}

describe("gcsAuth: which credential it uses", () => {
  it("uses GCS_CREDENTIALS_JSON first, even with an ADC file", async () => {
    const google = tokenEndpoint(token);
    const headers = await gcsAuth(
      {
        GCS_CREDENTIALS_JSON: JSON.stringify(serviceAccount),
        GOOGLE_APPLICATION_CREDENTIALS: file(JSON.stringify(authorizedUser)),
        HOME: home(JSON.stringify(authorizedUser)),
      },
      { fetch: google.fetch },
    )();
    expect(headers).toEqual({ Authorization: "Bearer synthetic-token" });
    expect(google.calls).toHaveLength(1);
    expect(google.calls[0].body).toContain(
      "grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer",
    );
  });

  it("uses the file that GOOGLE_APPLICATION_CREDENTIALS names", async () => {
    const google = tokenEndpoint(token);
    const headers = await gcsAuth(
      {
        GOOGLE_APPLICATION_CREDENTIALS: file(JSON.stringify(authorizedUser)),
        HOME: home(),
      },
      { fetch: google.fetch },
    )();
    expect(headers).toEqual({ Authorization: "Bearer synthetic-token" });
    expect(google.calls[0].body).toContain("grant_type=refresh_token");
  });

  it("uses the gcloud ADC file in HOME", async () => {
    const google = tokenEndpoint(token);
    const headers = await gcsAuth(
      { HOME: home(JSON.stringify(authorizedUser)) },
      { fetch: google.fetch },
    )();
    expect(headers).toEqual({ Authorization: "Bearer synthetic-token" });
    expect(google.calls).toHaveLength(1);
  });

  it.each([
    ["nothing set", {}],
    [
      "empty values",
      { GCS_CREDENTIALS_JSON: "", GOOGLE_APPLICATION_CREDENTIALS: "" },
    ],
    [
      "GOOGLE_APPLICATION_CREDENTIALS naming no file",
      { GOOGLE_APPLICATION_CREDENTIALS: "/nonexistent/adc.json" },
    ],
  ])(
    "sends no header and does not fail with no ADC file: %s",
    async (_, env) => {
      const google = tokenEndpoint(token);
      const headers = await gcsAuth(
        { ...env, HOME: home() },
        { fetch: google.fetch },
      )();
      expect(headers).toEqual({});
      expect(google.calls).toHaveLength(0);
    },
  );
});

describe("gcsAuth: credential failures have a fixed reason with no secret", () => {
  const expectNoSecret = (error: Error) => {
    expect(error.message).not.toContain(MARKER);
    expect(JSON.stringify(error)).not.toContain(MARKER);
    expect(String(error)).not.toContain(MARKER);
  };

  it.each([
    ["not JSON", `{"private_key": "${MARKER}"`],
    ["the wrong shape", JSON.stringify({ secret: MARKER })],
    [
      "a key that cannot sign",
      JSON.stringify({
        ...serviceAccount,
        private_key: `-----BEGIN PRIVATE KEY-----\n${MARKER}\n-----END PRIVATE KEY-----\n`,
      }),
    ],
  ])("GCS_CREDENTIALS_JSON that is %s", async (_, value) => {
    const google = tokenEndpoint(token);
    const error = await failure(
      gcsAuth(
        { GCS_CREDENTIALS_JSON: value, HOME: home() },
        { fetch: google.fetch },
      )(),
    );
    expect(error.message).toBe(INVALID_KEY);
    expectNoSecret(error);
    expect(google.calls).toHaveLength(0);
  });

  it("a token exchange that Google refuses", async () => {
    const google = tokenEndpoint(
      () =>
        new Response(
          JSON.stringify({
            error: "invalid_grant",
            error_description: `Invalid JWT Signature for ${MARKER}`,
          }),
          {
            status: 400,
            statusText: "Bad Request",
            headers: { "content-type": "application/json" },
          },
        ),
    );
    const error = await failure(
      gcsAuth(
        { GCS_CREDENTIALS_JSON: JSON.stringify(serviceAccount), HOME: home() },
        { fetch: google.fetch },
      )(),
    );
    expect(error.message).toBe(
      "could not get a Google access token: 400 Bad Request",
    );
    expectNoSecret(error);
  });

  it("a token exchange that does not reach Google", async () => {
    const google = tokenEndpoint(() => {
      throw new TypeError("fetch failed");
    });
    const error = await failure(
      gcsAuth(
        { GCS_CREDENTIALS_JSON: JSON.stringify(serviceAccount), HOME: home() },
        { fetch: google.fetch },
      )(),
    );
    expect(error.message).toBe(
      "could not get a Google access token: network error",
    );
    expectNoSecret(error);
  });

  it.each([
    ["not JSON", `{"refresh_token": "${MARKER}"`],
    ["an unknown type", JSON.stringify({ type: "mystery", secret: MARKER })],
  ])("an ADC file that is %s", async (_, content) => {
    const google = tokenEndpoint(token);
    const error = await failure(
      gcsAuth({ HOME: home(content) }, { fetch: google.fetch })(),
    );
    expect(error.message).toBe(ADC_FAILED);
    expectNoSecret(error);
  });

  it("an ADC refresh that Google refuses", async () => {
    const google = tokenEndpoint(
      () =>
        new Response(JSON.stringify({ error: "invalid_grant" }), {
          status: 400,
          statusText: "Bad Request",
          headers: { "content-type": "application/json" },
        }),
    );
    const error = await failure(
      gcsAuth(
        { HOME: home(JSON.stringify(authorizedUser)) },
        { fetch: google.fetch },
      )(),
    );
    expect(error.message).toBe(
      "could not get a Google access token: 400 Bad Request",
    );
    expectNoSecret(error);
  });
});
