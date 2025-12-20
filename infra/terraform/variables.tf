variable "project_id" {
  type        = string
  description = "ID do projeto GCP (ex.: dacora---tarefas)"
}

variable "region" {
  type        = string
  description = "Região padrão para recursos regionais"
  default     = "us-central1"
}

variable "firestore_location" {
  type        = string
  description = "Região do Firestore (ex.: nam5, southamerica-east1)"
  default     = "nam5"
}

variable "artifact_bucket_location" {
  type        = string
  description = "Localização do bucket GCS"
  default     = "us-central1"
}
