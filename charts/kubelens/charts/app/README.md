# Kubelens App Helm Chart

This chart deploys the Kubelens app component - a React-based web UI for managing Kubernetes clusters.

## Features

- Modern React UI with Tailwind CSS
- Multi-cluster dashboard
- Resource management interface
- Real-time updates via WebSocket
- Responsive design for mobile and desktop

## Installation

This chart is typically installed as part of the parent `kubelens` chart, but can be installed standalone:

```bash
helm install kubelens-app ./app
```

## Configuration

See [values.yaml](values.yaml) for all configuration options.

### Key Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `replicaCount` | Number of app replicas | `1` |
| `image.repository` | App image repository | `kubelens/app` |
| `image.tag` | App image tag | `""` (uses appVersion) |
| `service.type` | Kubernetes service type | `ClusterIP` |
| `service.port` | App service port | `80` |
| `resources.requests.cpu` | CPU request | `50m` |
| `resources.requests.memory` | Memory request | `64Mi` |

## Backend Connection

The app connects to the server service. When deployed as part of the parent chart, this is configured automatically.

For standalone deployment, configure:
```yaml
server:
  serviceName: "kubelens-server"
  servicePort: 8080
```

## Health Checks

- **Liveness probe**: Root path `/`, checked every 10s after 10s initial delay
- **Readiness probe**: Root path `/`, checked every 5s after 5s initial delay

## Security

- Runs as non-root user (nginx user, UID 101)
- Read-only root filesystem
- All capabilities dropped

