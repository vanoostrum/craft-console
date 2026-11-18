import type { Metadata } from "next";
import { projectsRead } from "@/lib/data-source";
import { ReadError } from "@/lib/read-error";
import { readAtLabel } from "@/lib/read-time";
import { repositoryRows } from "@/lib/repository-rows";
import { TopBar } from "./top-bar";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Projects · Craft Console" };

const BUCKET_URL =
  "https://console.cloud.google.com/storage/browser/craft-transcripts";

const SOURCE_NAME = {
  bucket: "the transcript bucket",
  linear: "Linear",
} as const;

function Heading() {
  return (
    <h1 id="projects-title">
      Projects{" "}
      <span className="sub">
        / sessions in the transcript bucket, tickets in Linear
      </span>
    </h1>
  );
}

const bucketLink = (
  <a className="primary" href={BUCKET_URL}>
    Open the bucket
  </a>
);

export default async function ProjectsPage() {
  let read;
  try {
    read = await projectsRead();
  } catch (error) {
    if (!(error instanceof ReadError)) throw error;
    return (
      <Page>
        <div className="panel-head">
          <Heading />
          {bucketLink}
        </div>
        <p className="notice error" role="alert">
          <strong>Could not read {SOURCE_NAME[error.source]}:</strong>{" "}
          {error.reason}. The page shows no numbers until the transcript bucket
          and Linear can both be read.
        </p>
      </Page>
    );
  }

  const { sessions, unreadable, tickets } = read.value;
  const rows = repositoryRows(sessions, tickets);
  return (
    <Page>
      <div className="panel-head">
        <div className="title">
          <Heading />
          <span className="read-at">{readAtLabel(read.readAt)}</span>
        </div>
        {bucketLink}
      </div>
      {unreadable.length > 0 && (
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
      )}
      <table>
        <thead>
          <tr>
            <th>Repository</th>
            <th className="num">Sessions</th>
            <th className="num">Tickets</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td className="empty" colSpan={3}>
                No sessions in the transcript bucket yet.
              </td>
            </tr>
          )}
          {rows.map((row) => (
            <tr
              key={row.repository ?? "no-repo"}
              className={row.repository === null ? "no-repo" : undefined}
            >
              <td className="name">{row.repository ?? "No repository"}</td>
              <td className="num">{row.sessions}</td>
              <td className="num">{row.tickets}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Page>
  );
}

function Page({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopBar current="/" />
      <main>
        <section className="panel" aria-labelledby="projects-title">
          {children}
        </section>
      </main>
    </>
  );
}
