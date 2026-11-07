"use client";

import { useState } from "react";
import { LEAD_STATUSES, type Lead } from "@/lib/leads";

export default function LeadsTable({
  leads,
  token,
}: {
  leads: Lead[];
  token: string | null;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function changeStatus(lead: Lead, status: string) {
    setBusyId(lead.id);
    setError("");
    const qs = token ? `?token=${encodeURIComponent(token)}` : "";
    const res = await fetch(`/api/leads/status${qs}`, {
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
  return (
    <div>
      {error && <p role="alert">{error}</p>}
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid #ccc" }}>Date</th>
            <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid #ccc" }}>Name</th>
            <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid #ccc" }}>Contact</th>
            <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid #ccc" }}>Service</th>
            <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid #ccc" }}>Message</th>
            <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid #ccc" }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr key={lead.id}>
              <td style={{ padding: "8px", borderBottom: "1px solid #eee", verticalAlign: "top" }}>
                {new Date(lead.created_at).toLocaleString()}
              </td>
              <td style={{ padding: "8px", borderBottom: "1px solid #eee", verticalAlign: "top" }}>
                {lead.name}
                {lead.repeatCount && lead.repeatCount > 1 ? (
                  <div><small>{lead.repeatCount === 2 ? "2nd" : `${lead.repeatCount}th`} enquiry from this contact</small></div>
                ) : null}
              </td>
              <td style={{ padding: "8px", borderBottom: "1px solid #eee", verticalAlign: "top" }}>{lead.contact}</td>
              <td style={{ padding: "8px", borderBottom: "1px solid #eee", verticalAlign: "top" }}>{lead.service}</td>
              <td style={{ padding: "8px", borderBottom: "1px solid #eee", verticalAlign: "top" }}>{lead.message ?? "—"}</td>
              <td style={{ padding: "8px", borderBottom: "1px solid #eee", verticalAlign: "top" }}>
                <select
                  value={lead.status}
                  disabled={busyId === lead.id}
                  onChange={(e) => changeStatus(lead, e.target.value)}
                  aria-label={`Status for ${lead.name}`}
                >
                  {LEAD_STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
