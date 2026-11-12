# Kubernetes — free local track (Lumen Hair Studio)

Run the salon site on a local Kubernetes cluster, on the Mac, for $0.
This is a **learning track**: it teaches the Kubernetes + Terraform
pattern companies use. It is **not** how real customer sites are
hosted — those stay on Vercel (see the production-readiness
checklist). A small business site gets dozens to hundreds of visits
a day; Vercel absorbs that without any of this. The point here is
the skill, and a real, watchable load balancer.

## How it fits together

```
lumen.local (your Mac, /etc/hosts -> 127.0.0.1)
  -> kind cluster (Docker containers acting as nodes)
    -> NGINX Ingress controller (front door, port 80)
      -> Service lumen-salon (ClusterIP, load-balances)
        -> Deployment, 3 replicas of the lumen-salon:test image
          -> each pod runs the Next.js standalone server on :3000
```

- **kind** creates the cluster: 1 control-plane + 2 workers, all as
  Docker containers on the Mac. Free, and it goes away with one
  command.
- **Terraform** (`infra/terraform/`) creates the app resources
  *inside* the cluster (Namespace, Deployment, Service, Ingress).
  It does not create the cluster itself — kind does that. The same
  Terraform pattern applies to a real cloud cluster later, where a
  cluster resource is added and these app resources stay the same.
- **The Docker image** is the one from the repo `Dockerfile`
  (`docker build -t lumen-salon:test .`), loaded into kind with
  `kind load docker-image`. kind has no registry to pull from, so
  the manifests use `imagePullPolicy: Never`.
- **Load balancing proof**: `/api/health` returns the hostname of
  the pod answering (`app/api/health/route.ts` — it is also the
  target of the Deployment's liveness/readiness probes). Curl it
  repeatedly and the `pod` value cycles between the 3 replicas.

## Why there is no Ansible here

Ansible configures machines. On a local kind cluster there is
nothing for it to configure: kind creates the nodes as Docker
containers, the app ships as a container image, and Terraform
manages the in-cluster resources. Adding a playbook would be
theatre. Ansible's real job in this stack is the **VPS track**:
installing Docker, hardening SSH, creating users on a real server.
If that track happens, the playbook belongs there — not here.

## Prerequisites (Mac, Terminal)

Docker Desktop must be installed and running first (the Docker
phase). Then:

```bash
brew install kind kubectl terraform
```

Check them: `docker --version && kind --version && kubectl version --client && terraform --version`

## Run it — in order

### 1. Create the cluster

```bash
cd ai-chatbot-site && kind create cluster --config k8s/kind-config.yaml
```

This writes the kubeconfig to `~/.kube/config` and switches
kubectl to the `kind-lumen-salon` context. Check it:
`kubectl cluster-info --context kind-lumen-salon`

### 2. Build the image and load it into kind

```bash
docker build -t lumen-salon:test . && kind load docker-image lumen-salon:test --name lumen-salon
```

(The image must be loaded — the pods use `imagePullPolicy: Never`
and kind cannot pull from your Mac's Docker daemon on its own.
Every time you rebuild the image, run the `kind load` again and
restart the pods: `kubectl rollout restart deployment/lumen-salon -n lumen`.)

### 3. Install the NGINX ingress controller

kind ships no ingress controller. This is the documented kind
setup (one command, then wait for it to be ready):

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml && kubectl wait --namespace ingress-nginx --for=condition=ready pod --selector=app.kubernetes.io/component=controller --timeout=120s
```

### 4. Deploy the app with Terraform

```bash
cd infra/terraform && terraform init && terraform apply
```

Type `yes` at the prompt. Terraform prints the app URL at the
end. (Prefer plain manifests instead? `kubectl apply -f k8s/`
deploys the identical Deployment, Service and Ingress — the two
paths are kept in sync. Do not use both: pick one, or Terraform
and kubectl will fight over the same resources.)

### 5. Point lumen.local at the cluster

```bash
echo "127.0.0.1 lumen.local" | sudo tee -a /etc/hosts
```

### 6. Open it

http://lumen.local — the salon homepage, served by the cluster.

## Prove the load balancing is real

Three replicas are running. Watch traffic spread across them:

```bash
for i in $(seq 1 12); do curl -s http://lumen.local/api/health; echo; done
```

The `pod` value cycles between the three pod names (e.g.
`lumen-salon-abc12-def34`, `...-ghi56-...`, `...-jkl78-...`).
Each line is a different pod answering — that is the Service
load-balancing. Also useful:

```bash
kubectl get pods -n lumen -o wide   # replicas, which node each is on
kubectl get svc -n lumen            # the ClusterIP Service
kubectl logs -n lumen -l app.kubernetes.io/name=lumen-salon --tail=20
```

No ingress yet? Port-forward straight to the Service instead:

```bash
kubectl port-forward -n lumen svc/lumen-salon 8080:80
# then in another terminal: for i in $(seq 1 6); do curl -s http://localhost:8080/api/health; echo; done
```

## Try scaling

```bash
kubectl scale deployment lumen-salon -n lumen --replicas=5
```

Re-run the curl loop: the `pod` values now cycle across five
names. Scale back with `--replicas=3`. (Or change the number with
Terraform: `terraform apply -var replicas=5`.)

## Tear it down

```bash
cd infra/terraform && terraform destroy
kind delete cluster --name lumen-salon
```

`terraform destroy` removes the app resources; `kind delete
cluster` removes the whole cluster (nodes, network, kubeconfig
context). Nothing is left running, nothing bills anything. Remove
the `/etc/hosts` line if you no longer want it.

## Troubleshooting

- **Pods stuck in `ImagePullBackOff` / `ErrImageNeverPull`** — the
  image is not in kind. Re-run step 2 (`kind load docker-image
  lumen-salon:test --name lumen-salon`), then
  `kubectl rollout restart deployment/lumen-salon -n lumen`.
- **http://lumen.local refuses to connect** — the ingress
  controller is not ready, or the port mappings did not apply.
  Check `kubectl get pods -n ingress-nginx` (controller must be
  `Running`) and that the cluster was created from
  `k8s/kind-config.yaml` (it carries the 80/443 mappings).
- **Browser shows the wrong site / DNS error** — the `/etc/hosts`
  line is missing or has a typo. `ping lumen.local` should answer
  `127.0.0.1`.
- **`terraform apply` complains about the cluster** — kubectl is
  pointing at another context. Run
  `kubectl config use-context kind-lumen-salon` and retry.
- **Old code serving after a rebuild** — you rebuilt the image but
  did not `kind load` it again, or the pods were not restarted.
  See step 2.

## What changes for a real cloud cluster

Same manifests, same Terraform app resources — only the platform
around them changes:

- **Cluster**: managed control plane (EKS ~$73/month, GKE ~$74/month
  for one zonal cluster, AKS control plane free) + worker nodes
  billed by the hour. That is the cost the free route avoids.
- **Image**: pushed to a registry (ECR / Artifact Registry /
  Docker Hub) with a real tag (`lumen-salon:v1.2.3`), and
  `imagePullPolicy: IfNotPresent` instead of `Never`.
- **Ingress**: a cloud load balancer in front (or the ingress
  controller's Service of type LoadBalancer), plus TLS via
  cert-manager + Let's Encrypt instead of plain HTTP.
- **Terraform**: gains the cluster itself (`aws_eks_cluster` and
  friends) and the registry; the app resources in
  `infra/terraform/main.tf` stay as they are.
- **Secrets**: env vars come from a secret manager (never
  `.env.local` baked into an image, and never committed).

For real small-business customers none of that is the first spend:
Vercel + one Supabase project per customer stays the hosting
answer. Kubernetes is the skill, not the first production
investment.

## What was verified here vs on the Mac

This workspace has **no Docker, kubectl, terraform or kind**, so
no cluster ran here and no `docker build` / `kind create` was
possible. What was verified in the workspace: all YAML parses
(Python yaml), the manifests and the Terraform describe the same
image (`lumen-salon:test`), replicas (3), probes (`/api/health`)
and resource limits, `npm run build` passes, `npm test` passes
(including the new `/api/health` test), and eval is 7/7. The real
proof — `kind create`, the curl loop showing three pod names —
runs on the Mac with the commands above.
