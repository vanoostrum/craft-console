import type { Metadata } from "next";
import Link from "next/link";
import { consoleSettings } from "@/lib/console-data";
import { PHASES, type Phase } from "@/lib/cost";
import { selectReaders } from "@/lib/data-source";
import { formatDuration, formatEuro, formatPlanPrice } from "@/lib/format";
import { MAX_SHARE_TIME_ZONE, maxShare } from "@/lib/max-share";
import { projects, ticketKeys, type PhaseValues } from "@/lib/projects";
import { shadeBy, type ShadeBy } from "@/lib/shade";
import { TopBar } from "./top-bar";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Projects · Craft Console" };

const BUCKET_URL =
  "https://console.cloud.google.com/storage/browser/craft-transcripts";

const SHADE_LABEL: Record<ShadeBy, string> = {
  cost: "cost",
  time: "craft time",
};

const monthName = (now: Date, month: "short" | "long") =>
  new Intl.DateTimeFormat("en-US", {
    month,
    timeZone: MAX_SHARE_TIME_ZONE,
  }).format(now);

function ShadeSwitch({ current }: { current: ShadeBy }) {
  return (
    <>
      <span className="label" id="shade-label">
        Shade by
      </span>
      <div className="toggle" role="group" aria-labelledby="shade-label">
        <Link href="/" aria-current={current === "cost" ? "true" : undefined}>
          € cost
        </Link>
        <Link
          href="/?shade=time"
          aria-current={current === "time" ? "true" : undefined}
        >
          craft time
        </Link>
      </div>
    </>
  );
}

function PhaseMix({ values, shade }: { values: PhaseValues; shade: ShadeBy }) {
  const total = PHASES.reduce((sum, phase) => sum + values[phase], 0);
  if (!(total > 0))
    return (
      <div
        className="mix"
        title={shade === "cost" ? "no cost" : "no craft time"}
      />
    );
  const parts = PHASES.filter((phase) => values[phase] > 0).map(
    (phase: Phase) => ({ phase, share: (100 * values[phase]) / total }),
  );
  return (
    <div
      className="mix"
      title={parts
        .map(({ phase, share }) => `${phase} ${Math.round(share)}%`)
        .join(", ")}
    >
      {parts.map(({ phase, share }) => (
        <span
          key={phase}
          className={`p-${phase}`}
          style={{ width: `${share}%` }}
        />
      ))}
    </div>
  );
}

const time = (seconds: number | null) =>
  seconds === null ? "—" : formatDuration(seconds);

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const shade = shadeBy((await searchParams).shade);
  const settings = consoleSettings(process.env);
  const readers = selectReaders(process.env.CONSOLE_DATA);
  const sessions = await readers.sessions.sessions();
  const found = await readers.tickets.tickets(ticketKeys(sessions));
  const rows = projects(sessions, found, settings.now);
  const shares = maxShare(rows, settings.maxPlanEur);
  const missing = [...new Set(rows.flatMap((row) => row.missingModels))].sort();
  const label = SHADE_LABEL[shade];

  return (
    <>
      <TopBar current="/" tools={<ShadeSwitch current={shade} />} />
      <main>
        <section className="panel" aria-labelledby="projects-title">
          <div className="panel-head">
            <h1 id="projects-title">
              Projects{" "}
              <span className="sub">
                / cost at API list prices, craft working time · phase mix by{" "}
                {label}
              </span>
            </h1>
            <a className="primary" href={BUCKET_URL}>
              Open the bucket
            </a>
          </div>
          <table>
            <thead>
              <tr>
                <th>Project</th>
                <th className="num">Tickets</th>
                <th className="num">Cost</th>
                <th className="num">Avg cost</th>
                <th className="num">Craft time</th>
                <th className="num">Avg time</th>
                <th className="num">Waiting on you</th>
                <th className="num">
                  Max share · {monthName(settings.now, "short")}
                </th>
                <th className="mix-col">Phase mix · {label}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const share = shares[index];
                return (
                  <tr
                    key={row.repository ?? "no-repo"}
                    className={row.repository === null ? "no-repo" : undefined}
                    data-sessions={row.sessions}
                  >
                    <td className="name">
                      {row.name}
                      {row.repository !== null && (
                        <>
                          {/* A break point, so a long name can wrap on a phone. */}
                          <wbr />
                          <span className="repo">{row.repository}</span>
                        </>
                      )}
                    </td>
                    <td className="num">{row.tickets}</td>
                    <td className="num strong">
                      {formatEuro(row.cost)}
                      {row.missingModels.length > 0 && " *"}
                    </td>
                    <td className="num">
                      {row.tickets > 0
                        ? formatEuro(row.cost / row.tickets)
                        : "—"}
                    </td>
                    <td className="num strong">{time(row.workSeconds)}</td>
                    <td className="num">
                      {row.workSeconds !== null && row.tickets > 0
                        ? formatDuration(row.workSeconds / row.tickets)
                        : "—"}
                    </td>
                    <td className="num wait">{time(row.waitSeconds)}</td>
                    <td className="num est">
                      {share === null ? "—" : `≈ €${Math.round(share)}`}
                    </td>
                    <td>
                      <PhaseMix
                        values={
                          shade === "cost" ? row.phaseCost : row.phaseWork
                        }
                        shade={shade}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="legend">
            {PHASES.map((phase) => (
              <span key={phase}>
                <i className={`p-${phase}`} />
                {phase}
              </span>
            ))}
          </div>
          {missing.length > 0 && (
            <p className="note">
              {missing.length === 1
                ? `* Some cost is missing: ${missing[0]} is not in the price table. Its tokens are left out of the cost.`
                : `* Some cost is missing: ${missing.join(", ")} are not in the price table. Their tokens are left out of the cost.`}
            </p>
          )}
          <p className="note">
            Max share: your {formatPlanPrice(settings.maxPlanEur)} Max plan for{" "}
            {monthName(settings.now, "long")}, split over the projects by their
            cost this month. An estimate: it assumes all Max use is craft.
          </p>
        </section>
      </main>
    </>
  );
}
