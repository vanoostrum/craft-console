import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { GoogleAuth, JWT, type AuthClient } from "google-auth-library";

const SCOPE = "https://www.googleapis.com/auth/devstorage.read_only";
const INVALID_KEY = "GCS_CREDENTIALS_JSON is not a valid service account key";
const ADC_FAILED = "could not load Application Default Credentials";

/** A credential failure before any bucket request. Its message is a fixed reason, never a credential. */
export class CredentialError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "CredentialError";
  }
}

export type Env = Record<string, string | undefined>;

/** A setting with a value. An empty value counts as not set. */
const setting = (value: string | undefined) => (value ? value : undefined);

/** The ADC file, if one exists: the file `GOOGLE_APPLICATION_CREDENTIALS` names, else the gcloud file in HOME. */
function adcFile(env: Env): string | undefined {
  const named = setting(env.GOOGLE_APPLICATION_CREDENTIALS);
  if (named && existsSync(named)) return named;
  const gcloud = join(
    setting(env.HOME) ?? homedir(),
    ".config/gcloud/application_default_credentials.json",
  );
  return existsSync(gcloud) ? gcloud : undefined;
}

type ClientOptions = {
  transporterOptions?: { fetchImplementation?: typeof fetch };
};

function serviceAccountClient(
  json: string,
  options: ClientOptions,
): AuthClient {
  let key: unknown;
  try {
    key = JSON.parse(json);
  } catch {
    throw new CredentialError(INVALID_KEY);
  }
  const { client_email, private_key } = (key ?? {}) as Record<string, unknown>;
  if (typeof client_email !== "string" || typeof private_key !== "string")
    throw new CredentialError(INVALID_KEY);
  return new JWT({
    email: client_email,
    key: private_key,
    scopes: [SCOPE],
    ...options,
  });
}

function adcClient(path: string, options: ClientOptions): AuthClient {
  try {
    const json = JSON.parse(readFileSync(path, "utf8"));
    return new GoogleAuth({ scopes: [SCOPE] }).fromJSON(json, options);
  } catch {
    throw new CredentialError(ADC_FAILED);
  }
}

/**
 * The token of `client` as headers. An HTTP failure of the token exchange gives
 * its status; a network failure gives "network error"; anything else, such as a
 * key that cannot sign, gives `otherwise`.
 */
async function bearer(
  client: AuthClient,
  otherwise: string,
): Promise<Record<string, string>> {
  try {
    const { token } = await client.getAccessToken();
    if (!token) throw new CredentialError(otherwise);
    return { Authorization: `Bearer ${token}` };
  } catch (error) {
    if (error instanceof CredentialError) throw error;
    // A GaxiosError: the token request failed, with or without an answer.
    const { response, config } = (error ?? {}) as {
      response?: { status?: number; statusText?: string };
      config?: unknown;
    };
    if (response?.status)
      throw new CredentialError(
        `could not get a Google access token: ${`${response.status} ${response.statusText ?? ""}`.trim()}`,
      );
    if (config)
      throw new CredentialError(
        "could not get a Google access token: network error",
      );
    throw new CredentialError(otherwise);
  }
}

/**
 * The headers for a bucket request, in this order: the service account key in
 * `GCS_CREDENTIALS_JSON`; else Application Default Credentials when an ADC file
 * exists; else none, for the cloud proxy, which adds them. It never probes the
 * GCE metadata server. Throws a `CredentialError` with a fixed reason.
 */
export function gcsAuth(
  env: Env,
  deps: { fetch?: typeof fetch } = {},
): () => Promise<Record<string, string>> {
  const options: ClientOptions = deps.fetch
    ? { transporterOptions: { fetchImplementation: deps.fetch } }
    : {};
  const key = setting(env.GCS_CREDENTIALS_JSON);
  if (key)
    return async () => bearer(serviceAccountClient(key, options), INVALID_KEY);
  const adc = adcFile(env);
  if (adc) return async () => bearer(adcClient(adc, options), ADC_FAILED);
  return async () => ({});
}
