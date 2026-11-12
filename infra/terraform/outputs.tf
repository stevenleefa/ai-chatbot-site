output "namespace" {
  description = "Namespace the app runs in."
  value       = kubernetes_namespace.lumen.metadata[0].name
}

output "service_name" {
  description = "ClusterIP Service fronting the replicas."
  value       = kubernetes_service.lumen_salon.metadata[0].name
}

output "ingress_host" {
  description = "Hostname the Ingress answers on."
  value       = var.host
}

output "app_url" {
  description = "URL of the salon site through the ingress (needs the host in /etc/hosts)."
  value       = "http://${var.host}"
}
