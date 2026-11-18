import type { Metadata } from "next";
import { selectReaders } from "@/lib/data-source";
import { repositoryRows, ticketKeys } from "@/lib/repository-rows";
import { TopBar } from "./top-bar";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Projects · Craft Console" };

const BUCKET_URL =
  "https://console.cloud.google.com/storage/browser/craft-transcripts";

export default async function ProjectsPage() {
  const readers = selectReaders(process.env.CONSOLE_DATA);
  const sessions = await readers.sessions.sessions();
  const found = await readers.tickets.tickets(ticketKeys(sessions));
  const rows = repositoryRows(sessions, found);

  return (
    <>
      <TopBar current="/" />
      <main>
        <section className="panel" aria-labelledby="projects-title">
          <div className="panel-head">
            <h1 id="projects-title">
              Projects{" "}
              <span className="sub">
                / sessions in the transcript bucket, tickets in Linear
              </span>
            </h1>
            <a className="primary" href={BUCKET_URL}>
              Open the bucket
            </a>
          </div>
          <table>
            <thead>
              <tr>
                <th>Repository</th>
                <th className="num">Sessions</th>
                <th className="num">Tickets</th>
              </tr>
            </thead>
            <tbody>
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
        </section>
      </main>
    </>
  );
}
