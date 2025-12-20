locals {
  services_to_enable = [
    "run.googleapis.com",
    "firestore.googleapis.com",
    "cloudbuild.googleapis.com",
    "secretmanager.googleapis.com",
    "iam.googleapis.com",
    "serviceusage.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "pubsub.googleapis.com",
    "cloudtasks.googleapis.com",
    "appengine.googleapis.com"
  ]
}

resource "google_project_service" "enabled_services" {
  for_each = toset(local.services_to_enable)

  project = var.project_id
  service = each.key

  disable_on_destroy         = false
  disable_dependent_services = false
}

resource "google_app_engine_application" "default" {
  project     = var.project_id
  location_id = var.firestore_location

  lifecycle {
    prevent_destroy = true
  }
}

resource "google_firestore_database" "primary" {
  project     = var.project_id
  name        = "(default)"
  location_id = var.firestore_location
  type        = "FIRESTORE_NATIVE"

  depends_on = [
    google_app_engine_application.default
  ]
}

resource "google_storage_bucket" "artifacts" {
  name                        = "${var.project_id}-artifacts"
  project                     = var.project_id
  location                    = var.artifact_bucket_location
  uniform_bucket_level_access = true

  versioning {
    enabled = true
  }

  lifecycle_rule {
    action {
      type = "Delete"
    }
    condition {
      age = 365
    }
  }
}

resource "google_service_account" "cloud_run_runner" {
  account_id   = "taskora-runner"
  display_name = "Taskora Cloud Run Runner"
  project      = var.project_id
}

resource "google_project_iam_member" "cloud_run_invoker" {
  project = var.project_id
  role    = "roles/run.invoker"
  member  = "serviceAccount:${google_service_account.cloud_run_runner.email}"
}

resource "google_project_iam_member" "service_account_token_creator" {
  project = var.project_id
  role    = "roles/iam.serviceAccountTokenCreator"
  member  = "serviceAccount:${google_service_account.cloud_run_runner.email}"
}

resource "google_pubsub_topic" "events" {
  name    = "taskora-events"
  project = var.project_id
}
