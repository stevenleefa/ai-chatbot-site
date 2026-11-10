// Shown instantly while /appointments renders on the server, so clicking
// Appointments never looks like a dead click while the diary loads.
export default function Loading() {
  return (
    <main style={{ maxWidth: 900, margin: "40px auto", padding: "0 20px" }}>
      <p>Loading appointments…</p>
    </main>
  );
}
