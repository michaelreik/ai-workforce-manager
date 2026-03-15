#!/bin/bash
ENV=${1:-staging}
NAMESPACE="openmanage-${ENV}"
kubectl -n "$NAMESPACE" logs -l app=openmanage-ai --tail=100 -f
