"use client";

import { useState } from "react";
import { LEAD_STATUSES, type Lead } from "@/lib/leads";
import DemoPopover from "@/components/DemoPopover";
import SortableTable, {
  type SortableColumn,
  type SortableRow,
} from "@/components/SortableTable";

export default function LeadsTable({
  leads,
  demo = false,
}: {
  leads: Lead[];
  // Test Admin Mode: the status select is disabled — a demo visitor
  // can look at the leads but cannot change a status (and
  // /api/leads/status refuses demo requests anyway).
  demo?: boolean;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function changeStatus(lead: Lead, status: string) {
    setBusyId(lead.id);
    setError("");
    // The session cookie authenticates this request — no token needed.
    const res = await fetch(`/api/leads/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: lead.id, status }),
    });
    setBusyId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not update status.");
      return;
    }
    window.location.reload();
  }

  if (leads.length === 0) {
    return <p>No leads yet. New booking requests will appear here.</p>;
  }

  // Default order is newest first (the order the page fetched them
  // in). Click any column heading to re-sort; changing a status
  // reloads the page, so the sort resets to newest first.
  const columns: SortableColumn[] = [
    { label: "Date", sortLabel: "Date" },
    { label: "Name", sortLabel: "Name" },
    { label: "Contact", sortLabel: "Contact" },
    { label: "Service", sortLabel: "Service" },
    { label: "Message", sortLabel: "Message" },
    { label: "Status", sortLabel: "Status" },
  ];
  const rows: SortableRow[] = leads.map((lead) => ({
    key: lead.id,
    cells: [
      // A rescheduled booking shows its NEW date (appointment_at)
      // instead of the date the booking was made — the owner sees
      // when the customer is actually coming in. The lead message
      // string is untouched; it still holds the original date/time.
      lead.appointment_at ? (
        <>
          {new Date(lead.appointment_at).toLocaleString()}
          <div>
            <small>Rescheduled</small>
          </div>
        </>
      ) : (
        new Date(lead.created_at).toLocaleString()
      ),
      <>
        {lead.name}
        {lead.repeatCount && lead.repeatCount > 1 ? (
          <div>
            <small>
              {lead.repeatCount === 2
                ? "2nd"
                : `${lead.repeatCount}th`}{" "}
              enquiry from this contact
            </small>
          </div>
        ) : null}
      </>,
      lead.contact,
      lead.service,
      lead.message ?? "—",
      <DemoPopover enabled={demo}>
        <select
          value={lead.status}
          disabled={demo || busyId === lead.id}
          onChange={(e) => changeStatus(lead, e.target.value)}
          aria-label={`Status for ${lead.name}`}
        >
          {LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </DemoPopover>,
    ],
    sort: [
      lead.created_at,
      lead.name,
      lead.contact,
      lead.service,
      lead.message ?? "",
      lead.status,
    ],
  }));

  return (
    <div>
      {error && <p role="alert">{error}</p>}
      <p className="dash-note">
        Click any column heading to sort by that column.
      </p>
      <SortableTable
        columns={columns}
        rows={rows}
        tableClassName="leads-table"
        wrapClassName={false}
      />
    </div>
  );
}
