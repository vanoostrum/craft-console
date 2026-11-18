import type { Metadata } from "next";
import Link from "next/link";
import { consoleSettings } from "@/lib/console-data";
import { PHASES, type Phase } from "@/lib/cost";
import { projectsRead } from "@/lib/data-source";
import { formatDuration, formatEuro, formatPlanPrice } from "@/lib/format";
import { MAX_SHARE_TIME_ZONE, maxShare } from "@/lib/max-share";
import { projectPath, projects, type PhaseValues } from "@/lib/projects";
import { ReadError } from "@/lib/read-error";
import { readAtLabel } from "@/lib/read-time";
import { shadeBy, type ShadeBy } from "@/lib/shade";
import { ReadErrorNotice, SkippedFilesNotice } from "./read-notices";
import { ShadeSwitch, withShade } from "./shade-switch";
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
  const label = SHADE_LABEL[shade];
  const heading = (
    <h1 id="projects-title">
      Projects{" "}
      <span className="sub">
        / cost at API list prices, craft working time · phase mix by {label}
      </span>
    </h1>
  );
  const bucketLink = (
    <a className="primary" href={BUCKET_URL}>
      Open the bucket
    </a>
  );
  const page = (content: React.ReactNode) => (
    <>
      <TopBar current="/" tools={<ShadeSwitch path="/" current={shade} />} />
      <main>
        <section className="panel" aria-labelledby="projects-title">
          {content}
        </section>
      </main>
    </>
  );

  let read;
  try {
    read = await projectsRead();
  } catch (error) {
    if (!(error instanceof ReadError)) throw error;
    return page(
      <>
        <div className="panel-head">
          {heading}
          {bucketLink}
        </div>
        <ReadErrorNotice error={error} />
      </>,
    );
  }

  const { sessions, unreadable, tickets } = read.value;
  const rows = projects(sessions, tickets, settings.now);
  const shares = maxShare(rows, settings.maxPlanEur);
  const missing = [...new Set(rows.flatMap((row) => row.missingModels))].sort();

  return page(
    <>
      <div className="panel-head">
        <div className="title">
          {heading}
          <span className="read-at">{readAtLabel(read.readAt)}</span>
        </div>
        {bucketLink}
      </div>
      <SkippedFilesNotice unreadable={unreadable} />
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
          {rows.length === 0 && (
            <tr>
              <td className="empty-row" colSpan={9}>
                No sessions in the transcript bucket yet.
              </td>
            </tr>
          )}
          {rows.map((row, index) => {
            const share = shares[index];
            return (
              <tr
                key={row.repository ?? "no-repo"}
                className={row.repository === null ? "no-repo" : undefined}
                data-sessions={row.sessions}
              >
                <td className="name">
                  <Link href={withShade(projectPath(row.repository), shade)}>
                    {row.name}
                  </Link>
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
                  {row.tickets > 0 ? formatEuro(row.cost / row.tickets) : "—"}
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
                    values={shade === "cost" ? row.phaseCost : row.phaseWork}
                    shade={shade}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {rows.length > 0 && (
        <>
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
        </>
      )}
    </>,
  );
}
