"use client";

import { useState } from "react";
import { PHASES } from "@/lib/cost";
import { formatDuration, formatEuro } from "@/lib/format";
import {
  shadeStep,
  type Cell,
  type GridRow,
  type ProjectGrid,
  type Sums,
} from "@/lib/project-grid";
import type { ShadeBy } from "@/lib/shade";

const time = (seconds: number | null) =>
  seconds === null ? "—" : formatDuration(seconds);

/** One rendered row: its group id for a fold button, and the groups above it. */
type Line = {
  row: GridRow;
  id: string | null;
  parents: string[];
  depth: number;
};

function lines(rows: readonly GridRow[], parents: string[], depth = 0): Line[] {
  return rows.flatMap((row): Line[] => {
    if (row.kind === "ticket" || row.kind === "noTicket")
      return [{ row, id: null, parents, depth }];
    const id =
      row.kind === "plan"
        ? `plan:${row.key}`
        : row.kind === "milestone"
          ? `${parents.at(-1)}/milestone:${row.label}`
          : "single";
    return [
      { row, id, parents, depth },
      ...lines(row.rows, [...parents, id], depth + 1),
    ];
  });
}

const label = (row: GridRow) =>
  row.kind === "plan" || row.kind === "milestone"
    ? row.label
    : row.kind === "single"
      ? "Single tickets"
      : "";

function CellTd({ cell, shade }: { cell: Cell; shade: string | null }) {
  if (cell === null) return <td className="empty">·</td>;
  return (
    <td className={shade === null ? "cell" : `cell ${shade}`}>
      <div>{formatEuro(cell.cost)}</div>
      {cell.workSeconds !== null && (
        <div>{formatDuration(cell.workSeconds)}</div>
      )}
    </td>
  );
}

function Totals({ sums }: { sums: Sums }) {
  return (
    <>
      <td className="tot sep">{formatEuro(sums.cost)}</td>
      <td className="tot">{time(sums.workSeconds)}</td>
      <td className="wait">{time(sums.waitSeconds)}</td>
    </>
  );
}

/**
 * The tickets × phases grid. It holds the fold state: every group is open on
 * load, and a folded group hides its rows, but keeps the fold state of the
 * milestones inside it.
 */
export function Grid({ grid, shade }: { grid: ProjectGrid; shade: ShadeBy }) {
  const [folded, setFolded] = useState<ReadonlySet<string>>(new Set());
  const toggle = (id: string) =>
    setFolded((old) => {
      const next = new Set(old);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const largest =
    shade === "cost" ? grid.largest.cost : grid.largest.workSeconds;
  const step = (cell: Cell) => {
    const n = shadeStep(
      cell === null ? null : shade === "cost" ? cell.cost : cell.workSeconds,
      largest,
    );
    return n === null ? null : `c${n}`;
  };

  return (
    <table className="grid">
      <thead>
        <tr>
          <th>Ticket</th>
          {PHASES.map((phase) => (
            <th key={phase}>{phase}</th>
          ))}
          <th className="sep">cost</th>
          <th>craft time</th>
          <th>waiting on you</th>
        </tr>
      </thead>
      <tbody>
        {lines(grid.rows, []).map(({ row, id, parents, depth }) => {
          const hidden = parents.some((p) => folded.has(p));
          if (row.kind === "ticket") {
            const t = row.ticket;
            return (
              <tr
                key={`${parents.join("/")}/${t.key}`}
                className={
                  parents.at(-1)?.includes("/milestone:")
                    ? "in-milestone"
                    : "in-plan"
                }
                hidden={hidden}
              >
                <td>
                  <span className="key">{t.key}</span>
                  {t.title}
                  <span className="state">{t.state}</span>
                </td>
                {PHASES.map((phase) => (
                  <CellTd
                    key={phase}
                    cell={row.sums.cells[phase]}
                    shade={step(row.sums.cells[phase])}
                  />
                ))}
                <Totals sums={row.sums} />
              </tr>
            );
          }
          if (row.kind === "noTicket")
            return (
              <tr key="no-ticket" className="group no-ticket">
                <td>No ticket</td>
                {PHASES.map((phase) => (
                  <CellTd
                    key={phase}
                    cell={row.sums.cells[phase]}
                    shade={step(row.sums.cells[phase])}
                  />
                ))}
                <Totals sums={row.sums} />
              </tr>
            );
          const open = !folded.has(id!);
          const name = label(row);
          return (
            <tr
              key={id}
              className={depth > 0 ? "milestone" : "group"}
              hidden={hidden}
            >
              <td>
                <button
                  type="button"
                  className="fold"
                  aria-expanded={open}
                  aria-label={`${open ? "Fold" : "Open"} ${name}`}
                  onClick={() => toggle(id!)}
                />
                {name}
              </td>
              {PHASES.map((phase) => (
                <CellTd key={phase} cell={row.sums.cells[phase]} shade={null} />
              ))}
              <Totals sums={row.sums} />
            </tr>
          );
        })}
        <tr className="total">
          <td>Total</td>
          {PHASES.map((phase) => (
            <CellTd key={phase} cell={grid.total.cells[phase]} shade={null} />
          ))}
          <Totals sums={grid.total} />
        </tr>
      </tbody>
    </table>
  );
}
