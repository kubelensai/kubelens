# Kubelens Server Helm Chart

This chart deploys the Kubelens server component - a Go-based API server that manages multi-cluster Kubernetes connections.

**This chart can be deployed standalone or as part of the parent Kubelens chart.**

## Features

- ✅ Multi-cluster Kubernetes management
- ✅ RESTful API for cluster resources
- ✅ WebSocket support for real-time updates
- ✅ SQLite database with persistent storage
- ✅ **Built-in RBAC** (automatically created)
- ✅ **ServiceAccount** (automatically created)
- ✅ Comprehensive cluster-wide permissions

## Installation

### Standalone Deployment

```bash
# From the server chart directory
helm install kubelens-server . \
  --namespace kubelens \
  --create-namespace
```

### As Part of Parent Chart

```bash
# From the parent kubelens chart
helm install kubelens . \
  --namespace kubelens \
  --create-namespace
```

## RBAC Configuration

**RBAC resources are created by default** to avoid human errors. The server requires cluster-wide permissions to manage multiple Kubernetes clusters.

### Default Permissions

The server is granted:
- ✅ **Read access** to all cluster resources
- ✅ **Write access** to specific resources:
  - Pod exec and port-forward
  - Deployments, StatefulSets, ReplicaSets (update, patch, scale)
  - Jobs and CronJobs (create, delete)
- ✅ **Metrics access** for monitoring

### Disable RBAC (Not Recommended)

```yaml
# values.yaml
rbac:
  create: false

serviceAccount:
  create: false
  name: "existing-service-account"
```

⚠️ **Warning**: Disabling RBAC requires you to manually create appropriate permissions.

## Configuration

### Key Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `replicaCount` | Number of server replicas | `1` |
| `image.repository` | Server image repository | `kubelensai/kubelens-server` |
| `image.tag` | Server image tag | `""` (uses appVersion) |
| `service.type` | Kubernetes service type | `ClusterIP` |
| `service.port` | Server service port | `8080` |
| `rbac.create` | Create RBAC resources | `true` |
| `serviceAccount.create` | Create ServiceAccount | `true` |
| `persistence.enabled` | Enable persistent storage | `true` |
| `persistence.size` | Size of persistent volume | `1Gi` |

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

## Examples

### Minimal Installation

```bash
helm install kubelens-server . \
  --set persistence.size=500Mi \
  --set resources.requests.cpu=100m \
  --set resources.requests.memory=128Mi
```

### Production with Custom Storage Class

```bash
helm install kubelens-server . \
  --set replicaCount=2 \
  --set persistence.size=5Gi \
  --set persistence.storageClass=fast-ssd \
  --set resources.requests.cpu=500m \
  --set resources.requests.memory=512Mi \
  --set resources.limits.cpu=1000m \
  --set resources.limits.memory=1Gi
```

### With External Database (Disable Persistence)

```bash
helm install kubelens-server . \
  --set persistence.enabled=false \
  --set env[0].name=DATABASE_PATH \
  --set env[0].value=/tmp/kubelens.db
```

## Security

### Pod Security Context

By default, the server runs with restricted security settings:
- ✅ Drops all capabilities
- ✅ Read-only root filesystem
- ✅ Runs as non-root user (UID 1000)
- ✅ FSGroup 2000 for persistent volume access

### Custom ServiceAccount

```yaml
# values.yaml
serviceAccount:
  create: true
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::ACCOUNT:role/KubelensServerRole
  name: "kubelens-server-custom"
```

## Upgrading

```bash
helm upgrade kubelens-server . \
  --namespace kubelens \
  --reuse-values
```

## Uninstalling

```bash
helm uninstall kubelens-server --namespace kubelens
```

⚠️ **Note**: PersistentVolumeClaim will be retained. Delete manually if needed:

```bash
kubectl delete pvc -n kubelens -l app.kubernetes.io/name=server
```

## Troubleshooting

### Server Can't Access Kubernetes API

Check RBAC permissions:
```bash
kubectl auth can-i get pods --as=system:serviceaccount:kubelens:kubelens-server-<release-name>
```

### Database Permission Issues

Check PVC and pod security context:
```bash
kubectl describe pvc -n kubelens
kubectl logs -n kubelens <pod-name>
```

## Integration with App Chart

When deployed with the parent chart, the app will automatically connect to the server service:

```yaml
# Parent chart automatically configures:
app:
  env:
    apiServer: "http://<release-name>-server:8080"
```

## Support

- GitHub: https://github.com/sonnguyen/kubelens
- Documentation: https://github.com/sonnguyen/kubelens/tree/main/docs
