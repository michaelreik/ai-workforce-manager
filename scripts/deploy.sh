#!/bin/bash
set -euo pipefail

ENV=${1:-staging}
IMAGE_TAG=${2:-latest}

if [[ "$ENV" != "staging" && "$ENV" != "production" ]]; then
  echo "Usage: ./scripts/deploy.sh [staging|production] [image-tag]"
  exit 1
fi

NAMESPACE="openmanage-${ENV}"
DOCKER_IMAGE="${DOCKER_IMAGE:-openmanage-ai}"

echo "Deploying to ${ENV} (tag: ${IMAGE_TAG})"

# Check cluster connection
if ! kubectl cluster-info &>/dev/null; then
  echo "Cannot connect to Kubernetes cluster"
  exit 1
fi

# Apply namespace (idempotent)
kubectl apply -f "k8s/${ENV}/namespace.yml"

# Apply config and secrets (if they exist)
kubectl apply -f "k8s/${ENV}/configmap.yml"

# Check if secrets exist (don't apply template with REPLACE_ME values)
if kubectl -n "$NAMESPACE" get secret openmanage-secrets &>/dev/null; then
  echo "Secrets already exist"
else
  echo "Secrets not found. Create them with:"
  echo "   kubectl -n $NAMESPACE create secret generic openmanage-secrets \\"
  echo "     --from-literal=SUPABASE_SERVICE_ROLE_KEY=... \\"
  echo "     --from-literal=ENCRYPTION_KEY=... \\"
  echo "     --from-literal=STRIPE_SECRET_KEY=... \\"
  echo "     --from-literal=STRIPE_WEBHOOK_SECRET=... \\"
  echo "     --from-literal=STRIPE_PRO_PRICE_ID=... \\"
  echo "     --from-literal=STRIPE_ENTERPRISE_PRICE_ID=... \\"
  echo "     --from-literal=RESEND_API_KEY=... \\"
  echo "     --from-literal=INTERNAL_API_SECRET=..."
  exit 1
fi

# Deploy with image tag substitution
export DOCKER_IMAGE IMAGE_TAG
envsubst < "k8s/${ENV}/deployment.yml" | kubectl apply -f -
kubectl apply -f "k8s/${ENV}/service.yml"
kubectl apply -f "k8s/${ENV}/ingress.yml"
kubectl apply -f "k8s/${ENV}/hpa.yml"
kubectl apply -f "k8s/${ENV}/pdb.yml"

# Production only: network policy
if [[ "$ENV" == "production" ]]; then
  kubectl apply -f "k8s/${ENV}/networkpolicy.yml"
fi

# Wait for rollout
echo "Waiting for rollout..."
kubectl -n "$NAMESPACE" rollout status deployment/openmanage-ai --timeout=180s

echo "Deployed to ${ENV}!"
echo "   Pods:"
kubectl -n "$NAMESPACE" get pods -l app=openmanage-ai
