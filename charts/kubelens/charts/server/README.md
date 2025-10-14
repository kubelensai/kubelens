# Kubelens Server Helm Chart

This chart deploys the Kubelens server component - a Go-based API server that manages multi-cluster Kubernetes connections.

## Features

- Multi-cluster Kubernetes management
- RESTful API for cluster resources
- WebSocket support for real-time updates
- SQLite database for cluster configurations
- Persistent storage support

## Installation

This chart is typically installed as part of the parent `kubelens` chart, but can be installed standalone:

```bash
helm install kubelens-server ./server
```

## Configuration

See [values.yaml](values.yaml) for all configuration options.

### Key Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `replicaCount` | Number of server replicas | `1` |
| `image.repository` | Server image repository | `kubelens/server` |
| `image.tag` | Server image tag | `""` (uses appVersion) |
| `service.type` | Kubernetes service type | `ClusterIP` |
| `service.port` | Server service port | `8080` |
| `persistence.enabled` | Enable persistent storage | `true` |
| `persistence.size` | Size of persistent volume | `1Gi` |
| `resources.requests.cpu` | CPU request | `250m` |
| `resources.requests.memory` | Memory request | `256Mi` |

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `8080` |
| `LOG_LEVEL` | Logging level | `info` |
| `DATABASE_PATH` | Database file path | `/data/kubelens.db` |

## Storage

The server requires persistent storage for:
- Cluster configurations
- User preferences
- Application state

By default, a PersistentVolumeClaim is created with 1Gi storage.

## Health Checks

- **Liveness probe**: `/health` endpoint, checked every 10s after 30s initial delay
- **Readiness probe**: `/health` endpoint, checked every 5s after 5s initial delay

