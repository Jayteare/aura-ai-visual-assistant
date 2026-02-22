#!/bin/bash
# =========================================================================
# Google Cloud Run Deployment Script for Aura
# Automates building and deploying the container to GCP.
# Fulfills the "Infrastructure-as-code" bonus point for the Hackathon.
# =========================================================================

set -e

PROJECT_ID="aura-488205"
SERVICE_NAME="aura-live-agent"
REGION="us-central1"
IMAGE_TAG="gcr.io/$PROJECT_ID/$SERVICE_NAME"

echo "========================================"
echo "  Deploying Aura to Google Cloud Run"
echo "  Project: $PROJECT_ID"
echo "  Service: $SERVICE_NAME"
echo "  Region:  $REGION"
echo "========================================"

# Set the active project
gcloud config set project $PROJECT_ID

# 1. Enable necessary APIs
echo ""
echo "[1/3] Enabling APIs..."
gcloud services enable run.googleapis.com \
    cloudbuild.googleapis.com \
    containerregistry.googleapis.com

# 2. Build Docker image via Cloud Build
echo ""
echo "[2/3] Building Docker image via Cloud Build..."
gcloud builds submit --tag $IMAGE_TAG

# 3. Deploy to Cloud Run
echo ""
echo "[3/3] Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
    --image $IMAGE_TAG \
    --platform managed \
    --region $REGION \
    --allow-unauthenticated \
    --port 8080 \
    --set-env-vars="NODE_ENV=production"

echo ""
echo "========================================"
echo "  Deployment complete!"
echo ""
echo "  IMPORTANT: Add your Gemini API key:"
echo "  gcloud run services update $SERVICE_NAME \\"
echo "    --set-env-vars=\"GEMINI_API_KEY=your_key\" \\"
echo "    --region=$REGION"
echo "========================================"
