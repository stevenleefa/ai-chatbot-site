// Shown instantly while /dashboard renders on the server, so clicking
// Dashboard never looks like a dead click while the figures load.
export default function Loading() {
  return (
    <main id="main-content" style={{ maxWidth: 900, margin: "40px auto", padding: "0 20px" }}>
      <p>Loading dashboard…</p>
    </main>
  );
}
