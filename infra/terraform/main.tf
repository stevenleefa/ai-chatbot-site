# The salon app, as Terraform resources. This mirrors
# k8s/deployment.yaml + k8s/ingress.yaml exactly (same image,
# replicas, probes, resource limits) — keep the two in sync. Apply
# with `terraform apply` from this directory, after the kind cluster
# exists and the image is loaded into it (see KUBERNETES.md).

resource "kubernetes_namespace" "lumen" {
  metadata {
    name = var.namespace
    labels = {
      "app.kubernetes.io/name" = "lumen-salon"
    }
  }
}

resource "kubernetes_deployment" "lumen_salon" {
  metadata {
    name      = "lumen-salon"
    namespace = kubernetes_namespace.lumen.metadata[0].name
    labels = {
      "app.kubernetes.io/name" = "lumen-salon"
    }
  }

  spec {
    replicas = var.replicas

    selector {
      match_labels = {
        "app.kubernetes.io/name" = "lumen-salon"
      }
    }

    template {
      metadata {
        labels = {
          "app.kubernetes.io/name" = "lumen-salon"
        }
      }

      spec {
        container {
          name              = "lumen-salon"
          image             = var.image
          image_pull_policy = "Never"

          port {
            container_port = 3000
            name           = "http"
          }

          resources {
            requests = {
              cpu    = "100m"
              memory = "128Mi"
            }
            limits = {
              cpu    = "500m"
              memory = "512Mi"
            }
          }

          readiness_probe {
            http_get {
              path = "/api/health"
              port = "http"
            }
            initial_delay_seconds = 5
            period_seconds        = 10
          }

          liveness_probe {
            http_get {
              path = "/api/health"
              port = "http"
            }
            initial_delay_seconds = 15
            period_seconds        = 20
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "lumen_salon" {
  metadata {
    name      = "lumen-salon"
    namespace = kubernetes_namespace.lumen.metadata[0].name
    labels = {
      "app.kubernetes.io/name" = "lumen-salon"
    }
  }

  spec {
    type = "ClusterIP"

    selector = {
      "app.kubernetes.io/name" = "lumen-salon"
    }

    port {
      port        = 80
      target_port = "http"
    }
  }
}

resource "kubernetes_ingress_v1" "lumen_salon" {
  metadata {
    name      = "lumen-salon"
    namespace = kubernetes_namespace.lumen.metadata[0].name
    labels = {
      "app.kubernetes.io/name" = "lumen-salon"
    }
    annotations = {
      "nginx.ingress.kubernetes.io/ssl-redirect" = "false"
    }
  }

  spec {
    ingress_class_name = "nginx"

    rule {
      host = var.host

      http {
        path {
          path      = "/"
          path_type = "Prefix"

          backend {
            service {
              name = kubernetes_service.lumen_salon.metadata[0].name
              port {
                number = 80
              }
            }
          }
        }
      }
    }
  }
}
