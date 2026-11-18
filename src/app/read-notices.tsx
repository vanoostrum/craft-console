import type { ReadError } from "@/lib/read-error";

const SOURCE_NAME = {
  bucket: "the transcript bucket",
  linear: "Linear",
} as const;

/** The notice for a failed read: the page shows no numbers. */
export function ReadErrorNotice({ error }: { error: ReadError }) {
  return (
    <p className="notice error" role="alert">
      <strong>Could not read {SOURCE_NAME[error.source]}:</strong>{" "}
      {error.reason}. The page shows no numbers until the transcript bucket and
      Linear can both be read.
    </p>
  );
}

/** The notice that lists the session files that could not be read; nothing when there are none. */
export function SkippedFilesNotice({ unreadable }: { unreadable: string[] }) {
  if (unreadable.length === 0) return null;
  return (
    <div className="notice" role="status">
      {unreadable.length === 1
        ? "1 session file could not be read and is not counted:"
        : `${unreadable.length} session files could not be read and are not counted:`}
      <ul>
        {unreadable.map((path) => (
          <li key={path}>{path}</li>
        ))}
      </ul>
    </div>
  );
}
