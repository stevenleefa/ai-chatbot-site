// Shown instantly while /admin renders on the server, so clicking
// Admin never looks like a dead click while the users list loads.
export default function Loading() {
  return (
    <main style={{ maxWidth: 900, margin: "40px auto", padding: "0 20px" }}>
      <p>Loading admin…</p>
    </main>
  );
}
