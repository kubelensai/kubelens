# Kubelens Helm Chart

A comprehensive Helm chart for deploying Kubelens - a modern, multi-cluster Kubernetes dashboard with real-time monitoring and management capabilities.

**This is a parent chart that orchestrates two independent sub-charts:**
- 🔧 **Server**: Go-based API server with RBAC and optional Ingress
- 🌐 **App**: React-based web interface with optional Ingress

## Features

- ✅ **Modular Architecture**: Server and App can be deployed independently
- ✅ **Auto-configured RBAC**: Server includes comprehensive cluster permissions by default
- ✅ **Dual Ingress Support**: Both Server and App can have independent Ingress configurations
- ✅ **Multi-cluster Support**: Manage multiple Kubernetes clusters from one dashboard
- ✅ **Real-time Updates**: WebSocket support for live cluster monitoring
- ✅ **Persistent Storage**: SQLite database with PVC support
- ✅ **Production Ready**: Security hardening, resource limits, health checks

## Chart Architecture

```
kubelens (parent)
├── server (sub-chart) - Independent deployment
│   ├── Deployment + Service
│   ├── Ingress (optional)
│   ├── RBAC (ClusterRole + ClusterRoleBinding)
│   ├── ServiceAccount
│   └── PersistentVolumeClaim
│
└── app (sub-chart) - Independent deployment
    ├── Deployment + Service
    └── Ingress (optional)
```

**Important**: The parent chart does **not** create any Kubernetes resources directly. It only includes and configures sub-charts.

## Quick Start

### Default Installation

```bash
# Install with default settings
helm install kubelens ./kubelens \
  --namespace kubelens \
  --create-namespace
```

### With Ingress (App Only)

```bash
# Install with app ingress enabled
helm install kubelens ./kubelens \
  --namespace kubelens \
  --create-namespace \
  --set app.ingress.enabled=true \
  --set app.ingress.hosts[0].host=kubelens.example.com \
  --set app.ingress.hosts[0].paths[0].path=/ \
  --set app.ingress.hosts[0].paths[0].pathType=Prefix
```

### With Dual Ingress (Both Server and App)

```bash
# Install with both server and app ingress enabled
helm install kubelens ./kubelens \
  --namespace kubelens \
  --create-namespace \
  --set server.ingress.enabled=true \
  --set server.ingress.hosts[0].host=api.kubelens.example.com \
  --set server.ingress.hosts[0].paths[0].path=/ \
  --set server.ingress.hosts[0].paths[0].pathType=Prefix \
  --set app.ingress.enabled=true \
  --set app.ingress.hosts[0].host=kubelens.example.com \
  --set app.ingress.hosts[0].paths[0].path=/ \
  --set app.ingress.hosts[0].paths[0].pathType=Prefix
```

### Access the Dashboard

```bash
# Port forward to access locally
kubectl port-forward -n kubelens svc/kubelens-app 8080:80

# Open http://localhost:8080 in your browser
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
| `server.image.repository` | Server image | `kubelensai/kubelens-server` |
| `server.image.tag` | Server image tag | `latest` |
| `server.ingress.enabled` | Enable ingress for server | `false` |
| `server.ingress.className` | Ingress class | `""` |
| `server.ingress.hosts` | Ingress hosts | `[{host: api.kubelens.app, ...}]` |
| `server.rbac.create` | Create RBAC resources | `true` |
| `server.serviceAccount.create` | Create ServiceAccount | `true` |
| `server.persistence.enabled` | Enable persistent storage | `true` |
| `server.persistence.size` | PVC size | `1Gi` |
| `server.adminPassword` | Admin password (auto-generated if empty) | `""` |

### App Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `app.enabled` | Enable app sub-chart | `true` |
| `app.replicaCount` | Number of app replicas | `1` |
| `app.image.repository` | App image | `kubelensai/kubelens-app` |
| `app.image.tag` | App image tag | `latest` |
| `app.ingress.enabled` | Enable ingress | `false` |
| `app.ingress.className` | Ingress class | `nginx` |

See [values.yaml](values.yaml) for all available options.

## Independent Sub-Chart Deployment

Both server and app can be deployed independently:

### Deploy Server Only

```bash
helm install kubelens-server ./kubelens/charts/server \
  --namespace kubelens \
  --create-namespace
```

See [server/README.md](charts/server/README.md) for detailed server configuration.

### Deploy App Only

```bash
helm install kubelens-app ./kubelens/charts/app \
  --namespace kubelens \
  --create-namespace \
  --set env.apiServer=http://my-backend-server:8080 \
  --set ingress.enabled=true
```

See [app/README.md](charts/app/README.md) for detailed app configuration.

## Production Examples

### Minimal Production Setup (Single Domain)

```yaml
# minimal-prod.yaml
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
    hosts:
      - host: kubelens.production.example.com
        paths:
          - path: /
            pathType: Prefix
    tls:
      - secretName: kubelens-app-tls
        hosts:
          - kubelens.production.example.com
```

### Production Setup with Dual Ingress (Separate Domains)

```yaml
# dual-ingress-prod.yaml
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
  # Set admin password for production
  adminPassword: "ChangeThisSecurePassword123!"
  ingress:
    enabled: true
    className: "nginx"
    annotations:
      cert-manager.io/cluster-issuer: "letsencrypt-prod"
      nginx.ingress.kubernetes.io/ssl-redirect: "true"
      nginx.ingress.kubernetes.io/cors-enable: "true"
      nginx.ingress.kubernetes.io/cors-allow-origin: "https://kubelens.example.com"
    hosts:
      - host: api.kubelens.example.com
        paths:
          - path: /
            pathType: Prefix
    tls:
      - secretName: kubelens-server-tls
        hosts:
          - api.kubelens.example.com

app:
  replicaCount: 3
  resources:
    requests:
      cpu: 100m
      memory: 128Mi
    limits:
      cpu: 200m
      memory: 256Mi
  env:
    apiServer: "https://api.kubelens.example.com"
  ingress:
    enabled: true
    className: "nginx"
    annotations:
      cert-manager.io/cluster-issuer: "letsencrypt-prod"
      nginx.ingress.kubernetes.io/ssl-redirect: "true"
    hosts:
      - host: kubelens.example.com
        paths:
          - path: /
            pathType: Prefix
    tls:
      - secretName: kubelens-app-tls
        hosts:
          - kubelens.example.com
```

**Deploy:**
```bash
helm install kubelens ./kubelens \
  -f dual-ingress-prod.yaml \
  --namespace kubelens \
  --create-namespace
```

```bash
helm install kubelens ./kubelens \
  -f minimal-prod.yaml \
  --namespace kubelens \
  --create-namespace
```

### High Availability Setup

```yaml
# ha-values.yaml
server:
  replicaCount: 3
  persistence:
    size: 10Gi
    storageClass: "fast-ssd"
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
  replicaCount: 5
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
  ingress:
    enabled: true
    className: "nginx"
    annotations:
      cert-manager.io/cluster-issuer: "letsencrypt-prod"
      nginx.ingress.kubernetes.io/rate-limit: "100"
      nginx.ingress.kubernetes.io/ssl-redirect: "true"
    hosts:
      - host: kubelens.ha.example.com
        paths:
          - path: /
            pathType: Prefix
    tls:
      - secretName: kubelens-ha-tls
        hosts:
          - kubelens.ha.example.com
```

```bash
helm install kubelens ./kubelens \
  -f ha-values.yaml \
  --namespace kubelens \
  --create-namespace
```

### Development Setup

```yaml
# dev-values.yaml
server:
  image:
    tag: "dev"
  persistence:
    size: 500Mi
  resources:
    requests:
      cpu: 100m
      memory: 128Mi
  env:
    - name: LOG_LEVEL
      value: "debug"

app:
  image:
    tag: "dev"
  resources:
    requests:
      cpu: 50m
      memory: 64Mi
  ingress:
    enabled: true
    className: "nginx"
    hosts:
      - host: kubelens.dev.local
        paths:
          - path: /
            pathType: Prefix
```

```bash
helm install kubelens ./kubelens \
  -f dev-values.yaml \
  --namespace kubelens-dev \
  --create-namespace
```

## RBAC & Security

### Default Admin Credentials

Kubelens automatically creates an admin user on first startup:
- **Email**: `admin@kubelens.local`
- **Username**: `admin`
- **Password**: 
  - If `server.adminPassword` is set: uses your password
  - If not set: **auto-generates a random 10-character password** (printed in logs)

⚠️ **Important**: When using auto-generated passwords, check the server logs on first startup to get the password!

### Configure Admin Password

**Option 1: Via Helm Values (Recommended)**
```yaml
# values.yaml
server:
  adminPassword: "your-secure-password"
```

```bash
helm install kubelens ./kubelens -f values.yaml
```

**Option 2: Via Command Line**
```bash
helm install kubelens ./kubelens \
  --set server.adminPassword="your-secure-password"
```

**Option 3: Auto-Generated Password (Default)**
```bash
# Install without setting password
helm install kubelens ./kubelens

# Check logs for auto-generated password
kubectl logs -n kubelens -l app.kubernetes.io/component=server | grep Password
```

**How It Works:**
- Chart creates a Kubernetes Secret with your password
- Secret is mounted as environment variable `ADMIN_PASSWORD`
- If no password is set, server generates a random one and prints it to logs
- Password is only printed when auto-generated (not when explicitly set)

### Default RBAC

The server chart automatically creates:
- ✅ **ClusterRole** with comprehensive permissions
- ✅ **ClusterRoleBinding** 
- ✅ **ServiceAccount**

**No manual RBAC configuration required!**

### Permissions Granted

- **Read access**: All cluster resources
- **Write access**: Limited to:
  - Pod exec and port-forward
  - Deployment scaling
  - Job/CronJob management
- **Metrics**: Read access for monitoring

### Disable RBAC (Not Recommended)

```yaml
server:
  rbac:
    create: false
  serviceAccount:
    create: false
    name: "existing-service-account"
```

⚠️ **Warning**: You must manually configure appropriate permissions.

## Upgrade

```bash
helm upgrade kubelens ./kubelens \
  --namespace kubelens \
  --reuse-values
```

## Uninstall

```bash
helm uninstall kubelens --namespace kubelens
```

⚠️ **Note**: PersistentVolumeClaim is retained by default. Delete manually if needed:

```bash
kubectl delete pvc -n kubelens -l app.kubernetes.io/name=server
```

## Troubleshooting

### Server Can't Access Kubernetes API

Check RBAC:
```bash
kubectl get clusterrole,clusterrolebinding -l app.kubernetes.io/component=server
kubectl auth can-i get pods --as=system:serviceaccount:kubelens:<sa-name>
```

### App Can't Connect to Server

Check connection:
```bash
kubectl get svc -n kubelens
kubectl logs -n kubelens -l app.kubernetes.io/component=app
```

Verify API server URL:
```bash
kubectl get pods -n kubelens -l app.kubernetes.io/component=app \
  -o jsonpath='{.items[0].spec.containers[0].env[?(@.name=="API_SERVER")].value}'
```

### Ingress Not Working

```bash
kubectl get ingress -n kubelens
kubectl describe ingress -n kubelens
```

Check Ingress controller:
```bash
kubectl get pods -n ingress-nginx
```

### View Logs

```bash
# Server logs
kubectl logs -n kubelens -l app.kubernetes.io/component=server --tail=100 -f

# App logs
kubectl logs -n kubelens -l app.kubernetes.io/component=app --tail=100 -f
```

## Architecture Details

### Communication Flow

#### Option 1: Single Ingress (App Only)
```
Internet/User
     ↓
  Ingress (App)
     ↓
  App Service (Port 80)
     ↓
  App Pods (React)
     ↓ /api/* proxy
  Server Service (Port 8080)
     ↓
  Server Pods (Go API)
     ↓
  Kubernetes API (RBAC)
     ↓
  Cluster Resources
```

#### Option 2: Dual Ingress (Both Server and App)
```
Internet/User
     ↓
  ┌─────────────┬─────────────┐
  ↓             ↓             ↓
Ingress (App)  Ingress (Server)
  ↓             ↓
App Service    Server Service
(Port 80)      (Port 8080)
  ↓             ↓
App Pods       Server Pods
(React)        (Go API)
  ↓             ↓
  └─────────────┴─────────────┘
                ↓
         Kubernetes API (RBAC)
                ↓
         Cluster Resources
```

### Storage Architecture

```
Server Pod
    ↓
PersistentVolumeClaim (1Gi)
    ↓
SQLite Database
    ├── Cluster configurations
    ├── User preferences
    └── Application state
```

## Values Reference

See [values.yaml](values.yaml) for complete configuration options.

## Sub-Chart Documentation

- **Server**: [charts/server/README.md](charts/server/README.md)
- **App**: [charts/app/README.md](charts/app/README.md)

## Support & Contributing

- **GitHub**: https://github.com/sonnguyen/kubelens
- **Documentation**: [docs/](../../docs/)
- **Issues**: https://github.com/sonnguyen/kubelens/issues

## License

See [LICENSE](../../LICENSE)
