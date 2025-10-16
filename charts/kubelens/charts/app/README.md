# Kubelens App Helm Chart

This chart deploys the Kubelens app component - a modern React-based web interface for managing Kubernetes clusters.

**This chart can be deployed standalone or as part of the parent Kubelens chart.**

## Features

- ✅ Modern React UI with Tailwind CSS
- ✅ Real-time cluster monitoring
- ✅ Multi-cluster management
- ✅ **Built-in Ingress support**
- ✅ Node.js proxy for API requests
- ✅ Mobile-ready with Capacitor support

## Installation

### Standalone Deployment

```bash
# From the app chart directory
helm install kubelens-app . \
  --namespace kubelens \
  --create-namespace \
  --set env.apiServer=http://kubelens-server:8080
```

⚠️ **Important**: For standalone deployment, you must specify the API server URL.

### As Part of Parent Chart

```bash
# From the parent kubelens chart
helm install kubelens . \
  --namespace kubelens \
  --create-namespace
```

The parent chart automatically configures the API server URL.

## Ingress Configuration

**Ingress resources are managed by this chart** for easy standalone deployment.

### Enable Ingress

```yaml
# values.yaml
ingress:
  enabled: true
  className: "nginx"
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
  hosts:
    - host: kubelens.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: kubelens-tls
      hosts:
        - kubelens.example.com
```

### Example with Cert-Manager

```bash
helm install kubelens-app . \
  --set ingress.enabled=true \
  --set ingress.hosts[0].host=kubelens.mycompany.com \
  --set ingress.hosts[0].paths[0].path=/ \
  --set ingress.hosts[0].paths[0].pathType=Prefix \
  --set ingress.tls[0].secretName=kubelens-tls \
  --set ingress.tls[0].hosts[0]=kubelens.mycompany.com \
  --set env.apiServer=http://kubelens-server:8080
```

## Configuration

### Key Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `replicaCount` | Number of app replicas | `1` |
| `image.repository` | App image repository | `kubelensai/kubelens-app` |
| `image.tag` | App image tag | `""` (uses appVersion) |
| `service.type` | Kubernetes service type | `ClusterIP` |
| `service.port` | App service port | `80` |
| `ingress.enabled` | Enable ingress | `false` |
| `ingress.className` | Ingress class name | `nginx` |
| `env.apiServer` | Backend API server URL | `""` (auto-configured in parent) |

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `API_SERVER` | Backend API URL | `http://server:8080` | **Yes** (standalone) |
| `PORT` | App server port | `80` | No |
| `NODE_ENV` | Node environment | `production` | No |

## Architecture

The app uses a Node.js Express server to:
1. Serve static React build files
2. Proxy `/api/*` requests to the backend server
3. Support WebSocket connections
4. Provide SPA routing

```
Browser → App (Node.js) → Server (Go API)
           ↓
         React UI
```

## Health Checks

- **Liveness probe**: `/` endpoint, checked every 10s after 10s initial delay
- **Readiness probe**: `/` endpoint, checked every 5s after 5s initial delay

## Examples

### Minimal Standalone Deployment

```yaml
# values.yaml
env:
  apiServer: "http://my-kubelens-server:8080"

ingress:
  enabled: true
  hosts:
    - host: kubelens.local
      paths:
        - path: /
          pathType: Prefix
```

```bash
helm install kubelens-app . -f values.yaml
```

### Production with Ingress + TLS

```yaml
# production-values.yaml
replicaCount: 3

resources:
  requests:
    cpu: 100m
    memory: 128Mi
  limits:
    cpu: 200m
    memory: 256Mi

env:
  apiServer: "http://kubelens-server:8080"

ingress:
  enabled: true
  className: "nginx"
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
  hosts:
    - host: kubelens.production.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: kubelens-prod-tls
      hosts:
        - kubelens.production.example.com

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

```bash
helm install kubelens-app . \
  -f production-values.yaml \
  --namespace kubelens \
  --create-namespace
```

### With Custom Backend URL

```bash
helm install kubelens-app . \
  --set env.apiServer=https://api.kubelens.example.com \
  --set ingress.enabled=true \
  --set ingress.hosts[0].host=ui.kubelens.example.com
```

## Security

### Pod Security Context

By default, the app runs with restricted security settings:
- ✅ Drops all capabilities
- ✅ Runs as non-root user (UID 1000)
- ⚠️ Read-only root filesystem is **disabled** (Node.js requires temp file access)

### Custom Security Context

```yaml
# values.yaml
securityContext:
  runAsUser: 2000
  runAsGroup: 2000
  allowPrivilegeEscalation: false
```

## Upgrading

```bash
helm upgrade kubelens-app . \
  --namespace kubelens \
  --reuse-values
```

## Uninstalling

```bash
helm uninstall kubelens-app --namespace kubelens
```

## Troubleshooting

### App Can't Connect to Backend

Check API server URL:
```bash
kubectl get pods -n kubelens -l app.kubernetes.io/component=app -o jsonpath='{.items[0].spec.containers[0].env[?(@.name=="API_SERVER")].value}'
```

Verify backend is accessible:
```bash
kubectl exec -n kubelens <app-pod> -- wget -O- http://kubelens-server:8080/health
```

### Ingress Not Working

Check Ingress status:
```bash
kubectl get ingress -n kubelens
kubectl describe ingress -n kubelens kubelens-app
```

Verify Ingress controller is running:
```bash
kubectl get pods -n ingress-nginx
```

### Logs

```bash
kubectl logs -n kubelens -l app.kubernetes.io/component=app --tail=100 -f
```

## Integration with Server Chart

When deployed with the parent chart:

```yaml
# Automatically configured by parent chart
app:
  env:
    apiServer: "http://<release-name>-server:8080"
```

For standalone deployment, you must manually specify the backend URL.

## Mobile Build Support

The app supports building as a mobile application using Capacitor:

```bash
# In the source directory
npm run build:mobile
npx cap sync
npx cap open android  # or ios
```

See [MOBILE.md](../../../src/app/MOBILE.md) for detailed instructions.

## Support

- GitHub: https://github.com/sonnguyen/kubelens
- Documentation: https://github.com/sonnguyen/kubelens/tree/main/docs
