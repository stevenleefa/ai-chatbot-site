// Health info for /api/health. The pod/container hostname is what
// lets you watch Kubernetes load-balancing: curl /api/health
// repeatedly and the `pod` value cycles between replicas. Kept as a
// pure function (no next/server import) so it is unit-testable in
// Jest — the route handler in app/api/health/route.ts is a thin
// wrapper around it.
// os.hostname() (not process.env.HOSTNAME): the Dockerfile sets
// HOSTNAME=0.0.0.0 for the server bind, while os.hostname() reads
// the real hostname — which Kubernetes sets to the pod name.
import os from "node:os";

export function getHealth() {
  return { ok: true, pod: os.hostname() };
}
