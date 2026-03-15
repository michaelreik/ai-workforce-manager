#!/bin/bash
set -euo pipefail

ENV=${1:-staging}
NAMESPACE="openmanage-${ENV}"

echo "Rolling back ${ENV} deployment..."
kubectl -n "$NAMESPACE" rollout undo deployment/openmanage-ai
kubectl -n "$NAMESPACE" rollout status deployment/openmanage-ai --timeout=120s
echo "Rollback complete"
kubectl -n "$NAMESPACE" get pods -l app=openmanage-ai
