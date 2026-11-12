# Terraform for the Lumen salon app on Kubernetes (free local track).
# Terraform manages the APP resources inside the cluster — it does
# NOT create the cluster itself. The cluster is kind, created with
# `kind create cluster --config k8s/kind-config.yaml` (see
# KUBERNETES.md). That split is deliberate: the same Terraform
# pattern applies to a real cloud cluster later, where the cluster
# resource (e.g. aws_eks_cluster) is added and this file stays the
# same. Requires Terraform >= 1.5 and a kubeconfig pointing at the
# kind cluster (kind writes ~/.kube/config on create).
terraform {
  required_version = ">= 1.5"

  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.30"
    }
  }
}

provider "kubernetes" {
  config_path = var.kubeconfig_path
}
