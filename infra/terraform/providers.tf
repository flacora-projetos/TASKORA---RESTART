terraform {
  required_version = ">= 1.6.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.28"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.28"
    }
  }

  backend "gcs" {
    bucket = "taskora-terraform-state"
    prefix = "state"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
}
