import Link from "next/link";

// The notice shown at the top of every owner page while Test Admin
// Mode (demo mode) is on. It exists so nobody mistakes the sample
// figures for the real business's data, and it names the one action
// that matters: nothing here changes anything. Uses the existing
// .demo-banner style — no new CSS.
export default function DemoBanner() {
  return (
    <p role="note" className="demo-banner">
      <strong>Test Admin Mode — sample data.</strong> You are browsing
      the owner area with demo figures, not the real business&apos;s
      data. Nothing you do here changes anything — actions are disabled
      in demo mode.{" "}
      <Link href="/api/demo?on=0">Exit Test Admin Mode</Link>
    </p>
  );
}
