// Shown instantly while a customer page renders on the server, so
// clicking a customer never looks like a dead click while it loads.
export default function Loading() {
  return (
    <main id="main-content" style={{ maxWidth: 900, margin: "40px auto", padding: "0 20px" }}>
      <p>Loading customer…</p>
    </main>
  );
}
