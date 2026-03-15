#!/bin/bash
ENV=${1:-staging}
NAMESPACE="openmanage-${ENV}"

echo "=== ${ENV} Status ==="
echo ""
echo "Pods:"
kubectl -n "$NAMESPACE" get pods -l app=openmanage-ai -o wide
echo ""
echo "HPA:"
kubectl -n "$NAMESPACE" get hpa openmanage-ai
echo ""
echo "Ingress:"
kubectl -n "$NAMESPACE" get ingress openmanage-ai
echo ""
echo "Recent Events:"
kubectl -n "$NAMESPACE" get events --sort-by='.lastTimestamp' | tail -10
