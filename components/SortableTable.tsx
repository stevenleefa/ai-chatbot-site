"use client";

// One shared sortable table for every owner-area table
// (/customers, /employees, /appointments, /leads, the customer and
// employee detail tables, and the dashboard tables). Clicking a
// column header sorts by that column; clicking it again reverses
// the order; the active column shows an arrow (▲ ascending,
// ▼ descending). The default order is exactly the order the rows
// were given in — nothing sorts until a header is clicked.
//
// How a page uses it (the page stays a server component — JSX cells
// are fine as props to a client component, but functions are not, so
// the sort value travels with the row as plain data):
//   <SortableTable
//     columns={[
//       { label: <>Customer <span className="tag tag-people">People</span></>,
//         sortLabel: "Customer" },
//       { label: "Total spent", sortLabel: "Total spent", numeric: true },
//     ]}
//     rows={customers.map((c) => ({
//       key: c.customer.id,
//       cells: [<Link ...>{c.customer.name}</Link>, money(c.totalSpent)],
//       sort: [c.customer.name, c.totalSpent],
//     }))}
//     totalRow={<tr className="total-row">…</tr>}  // optional, stays put
//   />
//
// Sort values: numbers sort numerically (money, counts); dates must
// be ISO strings ("2026-11-12") so they sort by date, not by the
// display string; everything else sorts alphabetically. Sorting is
// stable — equal values keep their original order. A total row, when
// given, is rendered after the sorted rows and is never sorted itself
// (it is a total, not a row). Uses only useState — React 18.3.1
// (no React 19 hooks; see the nextjs_auth_render_checks skill).

import { useMemo, useState, type ReactNode } from "react";

// What a column actually sorts by: a number, or a string (an ISO
// date string for date columns). One per column, in column order.
export type SortValue = string | number;

export type SortableColumn = {
  /** Header content — label text plus its colour chip, if any. The
      chip stays under the label; the sort arrow sits next to it. */
  label: ReactNode;
  /** Plain-text label for the sort button's accessible name. */
  sortLabel: string;
  /** Right-align the column (adds the "num" class) and sort its
      values numerically. */
  numeric?: boolean;
  /** Extra class on the <th> and <td> (overrides the "num" default). */
  className?: string;
};

export type SortableRow = {
  key: string;
  cells: ReactNode[];
  /** One sort value per column, in column order. */
  sort: SortValue[];
};

type Props = {
  columns: SortableColumn[];
  rows: SortableRow[];
  /** A footer row (e.g. totals) that stays at the bottom, unsorted. */
  totalRow?: ReactNode;
  /** Table class — "dash-table" by default. /leads passes
      "leads-table" to keep its plainer look. */
  tableClassName?: string;
  /** Wrapper div class — "table-wrap" by default; pass false for
      no wrapper (the leads table). */
  wrapClassName?: string | false;
};

export default function SortableTable({
  columns,
  rows,
  totalRow,
  tableClassName = "dash-table",
  wrapClassName = "table-wrap",
}: Props) {
  const [sort, setSort] = useState<{ col: number; dir: 1 | -1 } | null>(
    null
  );

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const { col, dir } = sort;
    return [...rows]
      .map((row, i) => ({ row, i }))
      .sort((a, b) => {
        const av = a.row.sort[col];
        const bv = b.row.sort[col];
        let cmp: number;
        if (typeof av === "number" && typeof bv === "number") {
          cmp = av - bv;
        } else {
          cmp = String(av).localeCompare(String(bv));
        }
        // Stable: equal values keep the order they arrived in.
        return cmp * dir || a.i - b.i;
      })
      .map(({ row }) => row);
  }, [rows, sort]);

  function toggle(col: number) {
    setSort((prev) =>
      prev && prev.col === col
        ? { col, dir: prev.dir === 1 ? -1 : 1 }
        : { col, dir: 1 }
    );
  }

  const table = (
    <table className={tableClassName}>
      <thead>
        <tr>
          {columns.map((c, i) => {
            const active = sort?.col === i;
            const cellClass = c.className ?? (c.numeric ? "num" : undefined);
            return (
              <th
                key={i}
                className={cellClass}
                aria-sort={
                  active
                    ? sort!.dir === 1
                      ? "ascending"
                      : "descending"
                    : "none"
                }
              >
                <button
                  type="button"
                  className="sort-btn"
                  onClick={() => toggle(i)}
                  title={`Sort by ${c.sortLabel}`}
                  aria-label={`Sort by ${c.sortLabel}${
                    active
                      ? sort!.dir === 1
                        ? ", currently ascending"
                        : ", currently descending"
                      : ""
                  }`}
                >
                  {c.label}
                  {active && (
                    <span className="sort-arrow" aria-hidden="true">
                      {sort!.dir === 1 ? " ▲" : " ▼"}
                    </span>
                  )}
                </button>
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {sorted.map((row) => (
          <tr key={row.key}>
            {row.cells.map((cell, i) => {
              const cellClass =
                columns[i].className ??
                (columns[i].numeric ? "num" : undefined);
              return (
                <td key={i} className={cellClass}>
                  {cell}
                </td>
              );
            })}
          </tr>
        ))}
        {totalRow}
      </tbody>
    </table>
  );

  if (wrapClassName === false) return table;
  // The wrapper scrolls horizontally on narrow screens, so it must be
  // keyboard-focusable: otherwise a keyboard user cannot scroll a wide
  // table at all (2.1.1). tabIndex 0 makes it a tab stop that scrolls
  // with the arrow keys.
  return (
    <div className={wrapClassName} tabIndex={0}>
      {table}
    </div>
  );
}
