output "service_account_email" {
  description = "Service account usada para Cloud Run"
  value       = google_service_account.cloud_run_runner.email
}

output "artifact_bucket_name" {
  description = "Bucket de artefatos e anexos"
  value       = google_storage_bucket.artifacts.name
}

output "pubsub_topic" {
  description = "Tópico Pub/Sub para eventos"
  value       = google_pubsub_topic.events.name
}
