#!/bin/bash
# =========================================================================
# Google Cloud Run Deployment Script
# This script automates the deployment of the Fix-It Live Agent to GCP.
# Fulfills the "Infrastructure-as-code" bonus point for the Hackathon.
# =========================================================================

# Ensure script stops on first error
set -e

# Configuration
PROJECT_ID=$(gcloud config get-value project)
SERVICE_NAME="fixit-live-agent"
REGION="us-central1"
IMAGE_TAG="gcr.io/$PROJECT_ID/$SERVICE_NAME"

echo "========================================"
echo "🚀 Deploying to Google Cloud Run"
echo "Project ID: $PROJECT_ID"
echo "Service Name: $SERVICE_NAME"
echo "Region: $REGION"
echo "========================================"

# 1. Enable necessary Google Cloud Services
echo "1️⃣ Enabling necessary APIs (Cloud Run, Cloud Build, Container Registry)..."
gcloud services enable run.googleapis.com \
    cloudbuild.googleapis.com \
    containerregistry.googleapis.com

# 2. Build the Docker image using Cloud Build
echo "2️⃣ Building Docker image via Cloud Build..."
gcloud builds submit --tag $IMAGE_TAG

# 3. Deploy to Cloud Run
echo "3️⃣ Deploying container to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
    --image $IMAGE_TAG \
    --platform managed \
    --region $REGION \
    --allow-unauthenticated \
    --port 8080 \
    --set-env-vars="NODE_ENV=production"

# Note: You should add your GEMINI_API_KEY as a secret manually in the console or via CLI:
# gcloud run deploy $SERVICE_NAME --update-secrets=GEMINI_API_KEY=YOUR_SECRET:latest

echo "✅ Deployment successful!"
