import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { attributedSegments } from "@/lib/attribution";
import { consoleSettings } from "@/lib/console-data";
import { projectsRead } from "@/lib/data-source";
import { formatDuration, formatEuro, formatPlanPrice } from "@/lib/format";
import { MAX_SHARE_TIME_ZONE, maxShare } from "@/lib/max-share";
import { projectGrid } from "@/lib/project-grid";
import { projectPath, projects } from "@/lib/projects";
import { ReadError } from "@/lib/read-error";
import { NO_REPO } from "@/lib/session-metadata";
import { shadeBy } from "@/lib/shade";
import { ReadErrorNotice, SkippedFilesNotice } from "../read-notices";
import { ShadeSwitch, withShade } from "../shade-switch";
import { TopBar } from "../top-bar";
import { Grid } from "./grid";

export type SearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

const NOTE: Record<"repo" | "no-repo", string> = {
  repo: 'A plan holds its plan ticket, with the brainstorm and setup sessions of its brief, and its tickets by milestone. "No ticket" is work that names no ticket, such as a craft:next run on its own, and brief sessions whose plan does not exist yet.',
  "no-repo":
    "Sessions that ran outside a repository. A brief session moves to the project of the plan that links its brief, once that plan exists.",
};

const time = (seconds: number | null) =>
  seconds === null ? "—" : formatDuration(seconds);

/**
 * The project of `repo` (a session's `repo` value), its grid, its Max share,
 * and the read it comes from; null when it has no sessions, or the `ReadError`
 * of a failed read. One read per request.
 */
const loadProject = cache(async (repo: string) => {
  const settings = consoleSettings(process.env);
  let read;
  try {
    read = await projectsRead();
  } catch (error) {
    if (error instanceof ReadError) return error;
    throw error;
  }
  const { sessions, unreadable, tickets } = read.value;
  const rows = projects(sessions, tickets, settings.now);
  const index = rows.findIndex((row) => (row.repository ?? NO_REPO) === repo);
  if (index < 0) return null;
  const segments = attributedSegments(sessions, tickets).filter(
    (s) => s.repo === repo,
  );
  return {
    settings,
    unreadable,
    project: rows[index],
    share: maxShare(rows, settings.maxPlanEur)[index],
    grid: projectGrid(segments, tickets),
  };
});

/** The name of `repo` when the read failed: its repository, or "No repository". */
const repoName = (repo: string) => (repo === NO_REPO ? "No repository" : repo);

export async function projectMetadata(repo: string): Promise<Metadata> {
  const data = await loadProject(repo);
  const name =
    data === null
      ? "Not found"
      : data instanceof ReadError
        ? repoName(repo)
        : data.project.name;
  return { title: `${name} · Craft Console` };
}

/** The project page of `repo`: the tiles and the tickets × phases grid. */
export async function ProjectPage({
  repo,
  searchParams,
}: {
  repo: string;
  searchParams: SearchParams;
}) {
  const shade = shadeBy((await searchParams).shade);
  const data = await loadProject(repo);
  if (data === null) notFound();
  const path = projectPath(repo === NO_REPO ? null : repo);
  /** The top bar, then the crumbs and `content` in main. */
  const frame = (name: string, content: React.ReactNode) => (
    <>
      <TopBar current="/" tools={<ShadeSwitch path={path} current={shade} />} />
      <main>
        <p className="crumbs">
          <Link href={withShade("/", shade)}>Projects</Link> / {name}
        </p>
        {content}
      </main>
    </>
  );
  if (data instanceof ReadError)
    return frame(repoName(repo), <ReadErrorNotice error={data} />);
  const { settings, unreadable, project, share, grid } = data;
  const missing = project.missingModels;
  const n = project.tickets;
  const month = new Intl.DateTimeFormat("en-US", {
    month: "short",
    timeZone: MAX_SHARE_TIME_ZONE,
  }).format(settings.now);

  return frame(
    project.name,
    <>
      <SkippedFilesNotice unreadable={unreadable} />
      <div className="summary" aria-label={`${project.name} totals`}>
        <div className="tile">
          <div className="k">Cost</div>
          <div className="v">
            {formatEuro(project.cost)}
            {missing.length > 0 && " *"}
          </div>
          <small>
            {n === 1 ? "1 ticket" : `${n} tickets`} ·{" "}
            {n > 0 ? formatEuro(project.cost / n) : "—"} a ticket
          </small>
        </div>
        <div className="tile">
          <div className="k">Craft time</div>
          <div className="v">{time(project.workSeconds)}</div>
          <small>
            {project.workSeconds !== null && n > 0
              ? formatDuration(project.workSeconds / n)
              : "—"}{" "}
            a ticket
          </small>
        </div>
        <div className="tile">
          <div className="k">Waiting on you</div>
          <div className="v wait">{time(project.waitSeconds)}</div>
          <small>time between craft&apos;s question and your answer</small>
        </div>
        <div className="tile">
          <div className="k">Max share · {month}</div>
          <div className="v est">
            {share === null ? "—" : `≈ €${Math.round(share)}`}
          </div>
          <small>
            estimate, of your {formatPlanPrice(settings.maxPlanEur)} Max plan
          </small>
        </div>
      </div>
      <section className="panel" aria-labelledby="grid-title">
        <div className="panel-head">
          <h1 id="grid-title">
            {project.name}{" "}
            <span className="sub">
              {project.repository === null ? "" : `${project.repository} `}/
              tickets × phases · each cell: cost, then craft working time ·
              shade = {shade === "cost" ? "cost" : "craft time"}
            </span>
          </h1>
          {project.repository !== null && project.linearUrl !== null && (
            <a className="primary" href={project.linearUrl}>
              Open in Linear
            </a>
          )}
        </div>
        <Grid grid={grid} shade={shade} />
        <p className="note">
          {NOTE[project.repository === null ? "no-repo" : "repo"]}
        </p>
        {missing.length > 0 && (
          <p className="note">
            {missing.length === 1
              ? `* Some cost is missing: ${missing[0]} is not in the price table. Its tokens are left out of the cost.`
              : `* Some cost is missing: ${missing.join(", ")} are not in the price table. Their tokens are left out of the cost.`}
          </p>
        )}
      </section>
    </>,
  );
}
