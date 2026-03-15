# OpenManage AI — Deployment Guide

## Prerequisites

- Docker installed locally
- kubectl configured with cluster access
- DockerHub account with push access
- Kubernetes cluster with:
  - nginx ingress controller
  - cert-manager (for Let's Encrypt TLS)
  - metrics-server (for HPA)

## Environments

| Environment | URL | Namespace | Replicas | Auto-Deploy |
|------------|-----|-----------|----------|-------------|
| Staging | staging.openmanage.ai | openmanage-staging | 2-5 | On push to main |
| Production | openmanage.ai | openmanage-production | 3-20 | Manual trigger |

## First-Time Setup

### 1. Create namespaces

```bash
kubectl apply -f k8s/staging/namespace.yml
kubectl apply -f k8s/production/namespace.yml
```

### 2. Create DockerHub credentials secret (both namespaces)

```bash
kubectl -n openmanage-staging create secret docker-registry dockerhub-credentials \
  --docker-server=docker.io \
  --docker-username=YOUR_USERNAME \
  --docker-password=YOUR_TOKEN

kubectl -n openmanage-production create secret docker-registry dockerhub-credentials \
  --docker-server=docker.io \
  --docker-username=YOUR_USERNAME \
  --docker-password=YOUR_TOKEN
```

### 3. Create application secrets

```bash
kubectl -n openmanage-staging create secret generic openmanage-secrets \
  --from-literal=SUPABASE_SERVICE_ROLE_KEY=... \
  --from-literal=ENCRYPTION_KEY=$(openssl rand -hex 32) \
  --from-literal=STRIPE_SECRET_KEY=sk_test_... \
  --from-literal=STRIPE_WEBHOOK_SECRET=whsec_... \
  --from-literal=STRIPE_PRO_PRICE_ID=price_... \
  --from-literal=STRIPE_ENTERPRISE_PRICE_ID=price_... \
  --from-literal=RESEND_API_KEY=re_... \
  --from-literal=INTERNAL_API_SECRET=$(openssl rand -hex 16)
```

(Same for production namespace with production values)

### 4. Set GitHub Secrets

In GitHub repo > Settings > Secrets > Actions:
- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`
- `KUBE_CONFIG` (base64-encoded kubeconfig)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 5. DNS

Create DNS records:
- `staging.openmanage.ai` — A record — Ingress Load Balancer IP
- `openmanage.ai` — A record — Ingress Load Balancer IP
- `www.openmanage.ai` — CNAME — `openmanage.ai`

## Deployment

### Automatic (via GitHub Actions)

- Push to `main` — auto-deploys to Staging
- Go to Actions > Deploy > Run workflow > Select "production" > Deploy

### Manual

```bash
./scripts/deploy.sh staging latest
./scripts/deploy.sh production v1.2.3
```

## Operations

### View logs

```bash
./scripts/logs.sh staging
./scripts/logs.sh production
```

### Check status

```bash
./scripts/status.sh production
```

### Rollback

```bash
./scripts/rollback.sh production
```

### Scale manually (overrides HPA temporarily)

```bash
kubectl -n openmanage-production scale deployment openmanage-ai --replicas=10
```

### Update secrets

```bash
kubectl -n openmanage-production delete secret openmanage-secrets
kubectl -n openmanage-production create secret generic openmanage-secrets --from-literal=...
kubectl -n openmanage-production rollout restart deployment/openmanage-ai
```

## Architecture

```
Internet → Cloudflare (DNS + optional CDN)
  → nginx Ingress Controller (TLS termination)
  → K8s Service (load balancing)
  → Pods (2-20 replicas, auto-scaled)
  → Supabase (external, managed)
  → OpenAI / Anthropic APIs (external)
  → Stripe (external)
  → Resend (external)
```

## Important Notes

### Streaming / SSE

The proxy at `/api/v1/chat/completions` supports SSE streaming.
Ingress is configured with `proxy-buffering: off` for this path.
If you use Cloudflare, disable response buffering for `/api/v1/*`.

### Rate Limiter

The in-memory rate limiter resets when pods restart or scale.
For production at scale, consider replacing with Redis (Upstash).
With multiple replicas, each pod has its own counter — effective
rate limit is `replicas x configured limit`.

### Secrets Rotation

1. Generate new value
2. `kubectl -n <namespace> create secret generic openmanage-secrets --from-literal=... --dry-run=client -o yaml | kubectl apply -f -`
3. `kubectl -n <namespace> rollout restart deployment/openmanage-ai`
