// components/SortableTable.tsx — the shared sortable table used by
// every owner-area table. Clicking a header sorts that column;
// clicking again reverses; the original order is kept until a
// header is clicked; a total row (when given) stays put.
import { render, screen, fireEvent, within } from "@testing-library/react";
import SortableTable from "@/components/SortableTable";

const COLUMNS = [
  { label: "Name", sortLabel: "Name" },
  { label: "Total spent", sortLabel: "Total spent", numeric: true },
];

// Deliberately unsorted input order.
const ROWS = [
  { key: "b", cells: ["Bella", "$30.00"], sort: ["Bella", 30] },
  { key: "a", cells: ["Ada", "$10.00"], sort: ["Ada", 10] },
  { key: "c", cells: ["Cara", "$20.00"], sort: ["Cara", 20] },
];

function rowNames(): string[] {
  const rows = screen.getAllByRole("row").slice(1); // skip the header row
  return rows.map((row) => within(row).getAllByRole("cell")[0].textContent!);
}

describe("SortableTable", () => {
  it("keeps the given order until a header is clicked", () => {
    render(<SortableTable columns={COLUMNS} rows={ROWS} />);
    expect(rowNames()).toEqual(["Bella", "Ada", "Cara"]);
  });

  it("sorts a numeric column ascending, then descending on a second click", () => {
    render(<SortableTable columns={COLUMNS} rows={ROWS} />);
    const btn = screen.getByRole("button", { name: /Sort by Total spent/ });

    fireEvent.click(btn);
    expect(rowNames()).toEqual(["Ada", "Cara", "Bella"]);
    expect(btn).toHaveAccessibleName("Sort by Total spent, currently ascending");

    fireEvent.click(btn);
    expect(rowNames()).toEqual(["Bella", "Cara", "Ada"]);
    expect(btn).toHaveAccessibleName("Sort by Total spent, currently descending");
  });

  it("sorts a text column alphabetically", () => {
    render(<SortableTable columns={COLUMNS} rows={ROWS} />);
    fireEvent.click(screen.getByRole("button", { name: /Sort by Name/ }));
    expect(rowNames()).toEqual(["Ada", "Bella", "Cara"]);
  });

  it("keeps equal values in their original order (stable sort)", () => {
    const tied = [
      { key: "x", cells: ["Xena", "$10.00"], sort: ["Xena", 10] },
      { key: "y", cells: ["Yara", "$10.00"], sort: ["Yara", 10] },
      { key: "z", cells: ["Zoe", "$5.00"], sort: ["Zoe", 5] },
    ];
    render(<SortableTable columns={COLUMNS} rows={tied} />);
    fireEvent.click(screen.getByRole("button", { name: /Sort by Total spent/ }));
    expect(rowNames()).toEqual(["Zoe", "Xena", "Yara"]);
  });

  it("a total row stays at the bottom, unsorted", () => {
    render(
      <SortableTable
        columns={COLUMNS}
        rows={ROWS}
        totalRow={
          <tr>
            <td>Total</td>
            <td>$60.00</td>
          </tr>
        }
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Sort by Total spent/ }));
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows.map((r) => within(r).getAllByRole("cell")[0].textContent)).toEqual([
      "Ada",
      "Cara",
      "Bella",
      "Total",
    ]);
  });
});
