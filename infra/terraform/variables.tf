variable "kubeconfig_path" {
  description = "Kubeconfig kind wrote when the cluster was created."
  type        = string
  default     = "~/.kube/config"
}

variable "namespace" {
  description = "Namespace the app runs in."
  type        = string
  default     = "lumen"
}

variable "image" {
  description = "Container image for the salon app. Built locally from the repo Dockerfile and loaded into kind: docker build -t lumen-salon:test . && kind load docker-image lumen-salon:test --name lumen-salon"
  type        = string
  default     = "lumen-salon:test"
}

variable "replicas" {
  description = "Number of app replicas. The Service load-balances across them — raise this and curl /api/health repeatedly to watch traffic spread."
  type        = number
  default     = 3
}

variable "host" {
  description = "Hostname the Ingress answers on. Add '127.0.0.1 <host>' to /etc/hosts on the Mac."
  type        = string
  default     = "lumen.local"
}
