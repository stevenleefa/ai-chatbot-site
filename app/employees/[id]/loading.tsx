// Shown instantly while an employee page renders on the server, so
// clicking an employee never looks like a dead click while it loads.
export default function Loading() {
  return (
    <main id="main-content" style={{ maxWidth: 900, margin: "40px auto", padding: "0 20px" }}>
      <p>Loading employee…</p>
    </main>
  );
}
