// Shown instantly while /leads renders on the server, so clicking
// Leads never looks like a dead click while the Supabase query runs.
export default function Loading() {
  return (
    <main id="main-content" style={{ maxWidth: 900, margin: "40px auto", padding: "0 20px" }}>
      <p>Loading leads…</p>
    </main>
  );
}
