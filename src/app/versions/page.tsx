import type { Metadata } from "next";
import { PHASES } from "@/lib/cost";
import {
  craftVersions,
  type Change,
  type VersionCell,
} from "@/lib/craft-versions";
import { projectsRead } from "@/lib/data-source";
import { formatDuration, formatEuro } from "@/lib/format";
import { shadeStep } from "@/lib/project-grid";
import { ReadError } from "@/lib/read-error";
import { shadeBy, type ShadeBy } from "@/lib/shade";
import { ReadErrorNotice, SkippedFilesNotice } from "../read-notices";
import { ShadeSwitch } from "../shade-switch";
import { TopBar } from "../top-bar";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Craft versions · Craft Console" };

const RELEASES = "https://github.com/vanoostrum/craft/releases";

const NOTE =
  'A phase counts toward the craft version that ran it. A cell is the average over the tickets that had that phase on that version, and "cost a ticket" is the sum of the cells. Work that names no ticket is left out. Craft time averages only over the tickets with time data. Sessions without a known craft version are under "Unknown version" and are not compared.';

function Delta({ change }: { change: Change }) {
  if (change === null) return null;
  if (change.kind === "first")
    return <span className="delta">first version</span>;
  const { percent, vs } = change;
  if (percent === 0) return <span className="delta">0% vs {vs}</span>;
  return percent < 0 ? (
    <span className="delta down">
      ▼ {-percent}% vs {vs}
    </span>
  ) : (
    <span className="delta up">
      ▲ {percent}% vs {vs}
    </span>
  );
}

function CellTd({ cell, step }: { cell: VersionCell | null; step: string }) {
  if (cell === null) return <td className="empty">·</td>;
  return (
    <td className={step ? `cell ${step}` : "cell"}>
      <div>{formatEuro(cell.cost)}</div>
      {cell.workSeconds !== null && (
        <div>{formatDuration(cell.workSeconds)}</div>
      )}
    </td>
  );
}

export default async function CraftVersionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const shade: ShadeBy = shadeBy((await searchParams).shade);
  const head = (
    <div className="panel-head">
      <h1 id="versions-title">
        Craft versions{" "}
        <span className="sub">
          / average per ticket, all projects · each cell: cost, then craft
          working time · shade = {shade === "cost" ? "cost" : "craft time"}
        </span>
      </h1>
      <a className="primary" href={RELEASES}>
        Craft releases
      </a>
    </div>
  );
  const page = (content: React.ReactNode) => (
    <>
      <TopBar
        current="/versions"
        tools={<ShadeSwitch path="/versions" current={shade} />}
      />
      <main>
        <section className="panel" aria-labelledby="versions-title">
          {head}
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
    return page(<ReadErrorNotice error={error} />);
  }
  const { sessions, unreadable, tickets } = read.value;
  const { rows, largest } = craftVersions(sessions, tickets);
  const notices = <SkippedFilesNotice unreadable={unreadable} />;
  if (!rows.some((row) => row.version !== null))
    return page(
      <>
        {notices}
        <p className="note">No craft version has finished a ticket yet.</p>
      </>,
    );

  const max = shade === "cost" ? largest.cost : largest.workSeconds;
  const step = (cell: VersionCell | null) => {
    const n = shadeStep(
      cell === null ? null : shade === "cost" ? cell.cost : cell.workSeconds,
      max,
    );
    return n === null ? "" : `c${n}`;
  };
  const missing = [...new Set(rows.flatMap((row) => row.missingModels))].sort();

  return page(
    <>
      {notices}
      <table className="grid">
        <thead>
          <tr>
            <th>Version</th>
            <th>Tickets</th>
            {PHASES.map((phase) => (
              <th key={phase}>{phase}</th>
            ))}
            <th className="sep">cost a ticket</th>
            <th>time a ticket</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.version ?? "unknown"}
              className={row.version === null ? "unknown" : undefined}
            >
              <td>
                {row.version === null ? (
                  "Unknown version"
                ) : (
                  <span className="key">{row.version}</span>
                )}
              </td>
              <td>{row.tickets}</td>
              {PHASES.map((phase) => (
                <CellTd
                  key={phase}
                  cell={row.cells[phase]}
                  step={row.version === null ? "" : step(row.cells[phase])}
                />
              ))}
              <td className="tot sep">
                {formatEuro(row.cost)}
                {row.missingModels.length > 0 && " *"}
                <Delta change={row.costChange} />
              </td>
              <td className="tot">
                {row.workSeconds === null
                  ? "—"
                  : formatDuration(row.workSeconds)}
                <Delta change={row.timeChange} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="note">{NOTE}</p>
      {missing.length > 0 && (
        <p className="note">
          {missing.length === 1
            ? `* Some cost is missing: ${missing[0]} is not in the price table. Its tokens are left out of the cost.`
            : `* Some cost is missing: ${missing.join(", ")} are not in the price table. Their tokens are left out of the cost.`}
        </p>
      )}
    </>,
  );
}
