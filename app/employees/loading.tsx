// Shown instantly while /employees renders on the server, so clicking
// Employees never looks like a dead click while the list loads.
export default function Loading() {
  return (
    <main id="main-content" style={{ maxWidth: 900, margin: "40px auto", padding: "0 20px" }}>
      <p>Loading employees…</p>
    </main>
  );
}
