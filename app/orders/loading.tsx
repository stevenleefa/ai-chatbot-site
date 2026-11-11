// Shown instantly while /orders renders on the server, so clicking
// Orders never looks like a dead click while the Supabase query runs.
export default function Loading() {
  return (
    <main id="main-content" style={{ maxWidth: 900, margin: "24px auto", padding: "0 20px" }}>
      <p>Loading orders…</p>
    </main>
  );
}
