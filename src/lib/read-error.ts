/** The source of a failed read, as the Projects page names it. */
export type ReadSource = "bucket" | "linear";

/**
 * A live read that failed. `reason` is safe to show: an HTTP status, a network
 * error, a GraphQL error message, or a fixed credential reason. Never a credential.
 */
export class ReadError extends Error {
  constructor(
    readonly source: ReadSource,
    readonly reason: string,
  ) {
    super(reason);
    this.name = "ReadError";
  }
}

/** A failed HTTP answer, as "403 Forbidden". */
export function httpReason(response: Response): string {
  return `${response.status} ${response.statusText}`.trim();
}

/**
 * The reason for anything a reader throws. Only messages that this code makes
 * itself, and network error messages, pass through.
 */
export function readError(source: ReadSource, error: unknown): ReadError {
  if (error instanceof ReadError) return error;
  if (error instanceof TypeError && error.message === "fetch failed") {
    const cause = (error as { cause?: unknown }).cause;
    return new ReadError(
      source,
      cause instanceof Error && cause.message ? cause.message : "fetch failed",
    );
  }
  return new ReadError(source, "unexpected error");
}
