# Kubelens Helm Chart

A comprehensive Helm chart for deploying Kubelens - a modern, multi-cluster Kubernetes dashboard.

## Overview

Kubelens provides a unified interface for managing multiple Kubernetes clusters from a single dashboard. This chart deploys both server API and app UI components.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Parent Chart                        │
│                   (kubelens)                         │
│                                                      │
│  ┌──────────────────┐      ┌──────────────────┐   │
│  │  Server         │      │  App         │   │
│  │  (sub-chart)     │◄─────┤  (sub-chart)      │   │
│  │                  │      │                   │   │
│  │  - Go API        │      │  - React UI       │   │
│  │  - SQLite DB     │      │  - Nginx          │   │
│  │  - WebSocket     │      │  - Static Files   │   │
│  └──────────────────┘      └──────────────────┘   │
│                                                      │
│  ┌──────────────────────────────────────────────┐  │
│  │         Ingress (optional)                    │  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
│  ┌──────────────────────────────────────────────┐  │
│  │         RBAC + ServiceAccount                 │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

## Features

- 🚀 **Multi-cluster Management**: Connect and manage multiple Kubernetes clusters
- 📊 **Comprehensive Dashboard**: View resources, logs, metrics across clusters
- 🔐 **RBAC Support**: Fine-grained access control with ServiceAccount
- 💾 **Persistent Storage**: SQLite database for cluster configurations
- 🌐 **Ingress Support**: Optional ingress with TLS/SSL
- 📦 **Modular Design**: Server and app as independent sub-charts
- ⚡ **Real-time Updates**: WebSocket support for live data

## Prerequisites

- Kubernetes 1.19+
- Helm 3.0+
- (Optional) Ingress controller (nginx, traefik, etc.)
- (Optional) cert-manager for TLS certificates

## Installation

### Quick Start

```bash
# Add the repository (if published)
helm repo add kubelens https://charts.kubelens.io
helm repo update

# Install with default values
helm install kubelens kubelens/kubelens

# Or install from local directory
helm install kubelens ./kubelens
```

### Custom Installation

```bash
# Install with custom values
helm install kubelens ./kubelens -f custom-values.yaml

# Install in specific namespace
helm install kubelens ./kubelens --namespace kubelens --create-namespace

# Install with ingress enabled
helm install kubelens ./kubelens \
  --set ingress.enabled=true \
  --set ingress.hosts[0].host=kubelens.example.com
```

### Upgrading

```bash
helm upgrade kubelens ./kubelens -f custom-values.yaml
```

### Uninstalling

```bash
helm uninstall kubelens
```

## Configuration

### Global Settings

| Parameter | Description | Default |
|-----------|-------------|---------|
| `global.imagePullSecrets` | Global image pull secrets | `[]` |

### Server Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `server.enabled` | Enable server sub-chart | `true` |
| `server.replicaCount` | Number of server replicas | `1` |
| `server.image.repository` | Server image repository | `kubelens/server` |
| `server.image.tag` | Server image tag | `latest` |
| `server.service.type` | Server service type | `ClusterIP` |
| `server.service.port` | Server service port | `8080` |
| `server.persistence.enabled` | Enable persistent storage | `true` |
| `server.persistence.size` | PVC size | `1Gi` |
| `server.resources.requests.cpu` | CPU request | `250m` |
| `server.resources.requests.memory` | Memory request | `256Mi` |

### App Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `app.enabled` | Enable app sub-chart | `true` |
| `app.replicaCount` | Number of app replicas | `1` |
| `app.image.repository` | App image repository | `kubelens/app` |
| `app.image.tag` | App image tag | `latest` |
| `app.service.type` | App service type | `ClusterIP` |
| `app.service.port` | App service port | `80` |
| `app.resources.requests.cpu` | CPU request | `50m` |
| `app.resources.requests.memory` | Memory request | `64Mi` |

### Ingress Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `ingress.enabled` | Enable ingress | `false` |
| `ingress.className` | Ingress class name | `nginx` |
| `ingress.annotations` | Ingress annotations | See values.yaml |
| `ingress.hosts` | Ingress hosts configuration | See values.yaml |
| `ingress.tls` | TLS configuration | See values.yaml |

### RBAC Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `rbac.create` | Create RBAC resources | `true` |
| `rbac.rules` | RBAC rules | Cluster-wide read + limited write |
| `serviceAccount.create` | Create ServiceAccount | `true` |
| `serviceAccount.name` | ServiceAccount name | Generated from release name |

## Examples

### Minimal Installation

```yaml
# minimal-values.yaml
server:
  persistence:
    size: 500Mi
  resources:
    requests:
      cpu: 100m
      memory: 128Mi

app:
  resources:
    requests:
      cpu: 25m
      memory: 32Mi
```

```bash
helm install kubelens ./kubelens -f minimal-values.yaml
```

### Production Installation with Ingress

```yaml
# production-values.yaml
server:
  replicaCount: 2
  persistence:
    size: 5Gi
    storageClass: "fast-ssd"
  resources:
    requests:
      cpu: 500m
      memory: 512Mi
    limits:
      cpu: 1000m
      memory: 1Gi

app:
  replicaCount: 3
  resources:
    requests:
      cpu: 100m
      memory: 128Mi
    limits:
      cpu: 200m
      memory: 256Mi

ingress:
  enabled: true
  className: "nginx"
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
  hosts:
    - host: kubelens.production.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: kubelens-tls
      hosts:
        - kubelens.production.example.com
```

```bash
helm install kubelens ./kubelens \
  -f production-values.yaml \
  --namespace kubelens \
  --create-namespace
```

### High Availability Setup

```yaml
# ha-values.yaml
server:
  replicaCount: 3
  affinity:
    podAntiAffinity:
      preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 100
        podAffinityTerm:
          labelSelector:
            matchExpressions:
            - key: app.kubernetes.io/component
              operator: In
              values:
              - server
          topologyKey: kubernetes.io/hostname

app:
  replicaCount: 3
  affinity:
    podAntiAffinity:
      preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 100
        podAffinityTerm:
          labelSelector:
            matchExpressions:
            - key: app.kubernetes.io/component
              operator: In
              values:
              - app
          topologyKey: kubernetes.io/hostname
```

## Accessing Kubelens

### Port Forward (Development)

```bash
# Forward app port
kubectl port-forward svc/kubelens-app 8080:80

# Access at http://localhost:8080
```

### Via Ingress (Production)

Access via configured ingress hostname, e.g., `https://kubelens.example.com`

### Via LoadBalancer

```yaml
app:
  service:
    type: LoadBalancer
```

Then get the external IP:
```bash
kubectl get svc kubelens-app
```

## Troubleshooting

### Check Pod Status

```bash
kubectl get pods -l app.kubernetes.io/name=kubelens
```

### View Server Logs

```bash
kubectl logs -l app.kubernetes.io/component=server
```

### View App Logs

```bash
kubectl logs -l app.kubernetes.io/component=app
```

### Check Persistent Volume

```bash
kubectl get pvc
kubectl describe pvc kubelens-server-data
```

### Common Issues

1. **Server not starting**: Check PVC is bound and accessible
2. **App can't connect to server**: Verify service names and ports
3. **Ingress not working**: Ensure ingress controller is installed
4. **Permission denied**: Check RBAC rules and ServiceAccount

## Sub-charts

This chart includes two sub-charts:

- **server**: Go-based API server ([README](charts/server/README.md))
- **app**: React-based UI ([README](charts/app/README.md))

Each sub-chart can be configured independently or disabled:

```yaml
server:
  enabled: true
  # ... server configuration

app:
  enabled: true
  # ... app configuration
```

## Development

### Build Dependencies

```bash
helm dependency build ./kubelens
```

### Lint Chart

```bash
helm lint ./kubelens
```

### Template Output

```bash
helm template kubelens ./kubelens
```

### Test Installation

```bash
helm install --dry-run --debug kubelens ./kubelens
```

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](../../../CONTRIBUTING.md)

## License

This project is licensed under the MIT License - see [LICENSE](../../../LICENSE)

## Support

- GitHub Issues: https://github.com/sonnguyen/kubelens/issues
- Documentation: https://kubelens.io/docs
- Slack: https://kubelens.slack.com

