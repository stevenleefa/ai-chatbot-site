import { NextResponse } from "next/server";
import { getHealth } from "@/lib/health";

// Tiny health endpoint. It returns the hostname of the pod/container
// serving the request, so you can watch Kubernetes load-balancing
// spread traffic across replicas: curl it repeatedly and the `pod`
// value changes between replicas. It is also the target of the
// Deployment's liveness/readiness probes (see k8s/deployment.yaml
// and infra/terraform/main.tf).
//
// `force-dynamic` matters: without it Next.js could prerender this
// route at build time and freeze in the build machine's hostname.
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getHealth());
}
