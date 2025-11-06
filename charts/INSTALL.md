# Kubelens Helm Chart Installation Guide

This guide provides multiple ways to install Kubelens using Helm.

## 📦 Installation Methods

### Method 1: GitHub Pages Helm Repository (Recommended)

Add the Kubelens Helm repository:

```bash
helm repo add kubelens https://YOUR_GITHUB_USERNAME.github.io/kubelens
helm repo update
```

Install Kubelens:

```bash
# Install with default values
helm install kubelens kubelens/kubelens

# Install in a specific namespace
helm install kubelens kubelens/kubelens --namespace kubelens --create-namespace

# Install with custom values
helm install kubelens kubelens/kubelens -f values.yaml
```

List available versions:

```bash
helm search repo kubelens -l
```

### Method 2: GitHub Container Registry (OCI)

Install directly from GHCR:

```bash
# Install latest version
helm install kubelens oci://ghcr.io/YOUR_GITHUB_USERNAME/charts/kubelens

# Install specific version
helm install kubelens oci://ghcr.io/YOUR_GITHUB_USERNAME/charts/kubelens --version 1.0.0

# With custom values
helm install kubelens oci://ghcr.io/YOUR_GITHUB_USERNAME/charts/kubelens \
  --version 1.0.0 \
  -f values.yaml
```

### Method 3: Docker Hub (OCI)

Install directly from Docker Hub:

```bash
# Install latest version
helm install kubelens oci://YOUR_DOCKERHUB_USERNAME/charts/kubelens

# Install specific version
helm install kubelens oci://YOUR_DOCKERHUB_USERNAME/charts/kubelens --version 1.0.0

# With custom values
helm install kubelens oci://YOUR_DOCKERHUB_USERNAME/charts/kubelens \
  --version 1.0.0 \
  -f values.yaml
```

### Method 4: From GitHub Release

Download the chart from GitHub releases:

```bash
# Download chart
curl -LO https://github.com/YOUR_GITHUB_USERNAME/kubelens/releases/download/v1.0.0/kubelens-1.0.0.tgz

# Install from local file
helm install kubelens ./kubelens-1.0.0.tgz
```

## 🔧 Configuration

### Quick Start with Default Values

```bash
helm install kubelens kubelens/kubelens \
  --namespace kubelens \
  --create-namespace
```

### Custom Configuration

Create a `values.yaml` file:

```yaml
# Database configuration
database:
  type: postgresql  # sqlite, postgresql, mysql
  postgresql:
    deploy: true
    auth:
      username: kubelens
      password: changeme
      database: kubelens

# Server configuration
server:
  replicaCount: 2
  resources:
    requests:
      memory: "256Mi"
      cpu: "100m"
    limits:
      memory: "512Mi"
      cpu: "500m"

# App configuration
app:
  replicaCount: 2
  
# Ingress configuration
ingress:
  enabled: true
  className: nginx
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

Install with custom values:

```bash
helm install kubelens kubelens/kubelens \
  --namespace kubelens \
  --create-namespace \
  -f values.yaml
```

## 🔄 Upgrade

### From Helm Repository

```bash
# Update repository
helm repo update

# Upgrade to latest version
helm upgrade kubelens kubelens/kubelens

# Upgrade to specific version
helm upgrade kubelens kubelens/kubelens --version 1.0.1

# Upgrade with new values
helm upgrade kubelens kubelens/kubelens -f values.yaml
```

### From OCI Registry

```bash
# Upgrade to specific version
helm upgrade kubelens oci://ghcr.io/YOUR_GITHUB_USERNAME/charts/kubelens --version 1.0.1
```

## 🗑️ Uninstall

```bash
# Uninstall release
helm uninstall kubelens --namespace kubelens

# Delete namespace (optional)
kubectl delete namespace kubelens
```

## 📋 Verify Installation

Check the deployment status:

```bash
# List releases
helm list --namespace kubelens

# Get release status
helm status kubelens --namespace kubelens

# Check pods
kubectl get pods --namespace kubelens

# Check services
kubectl get svc --namespace kubelens
```

## 🔍 Troubleshooting

### View release values

```bash
helm get values kubelens --namespace kubelens
```

### View all resources

```bash
kubectl get all --namespace kubelens
```

### View logs

```bash
# Server logs
kubectl logs -l app.kubernetes.io/component=server --namespace kubelens -f

# App logs
kubectl logs -l app.kubernetes.io/component=app --namespace kubelens -f
```

### Rollback to previous version

```bash
# View release history
helm history kubelens --namespace kubelens

# Rollback to previous revision
helm rollback kubelens --namespace kubelens

# Rollback to specific revision
helm rollback kubelens 1 --namespace kubelens
```

## 📚 Additional Resources

- **GitHub Repository**: https://github.com/YOUR_GITHUB_USERNAME/kubelens
- **Documentation**: https://YOUR_GITHUB_USERNAME.github.io/kubelens
- **Helm Chart Values**: See `values.yaml` in the chart for all configuration options
- **Examples**: See `examples/` directory for sample configurations

## 🆘 Support

If you encounter any issues:

1. Check the [GitHub Issues](https://github.com/YOUR_GITHUB_USERNAME/kubelens/issues)
2. Review the [Documentation](https://YOUR_GITHUB_USERNAME.github.io/kubelens)
3. Join our community discussions

## 🎯 Quick Examples

### Minimal Installation

```bash
helm install kubelens oci://ghcr.io/YOUR_GITHUB_USERNAME/charts/kubelens
```

### Production Installation with PostgreSQL

```bash
helm install kubelens kubelens/kubelens \
  --namespace kubelens \
  --create-namespace \
  --set database.type=postgresql \
  --set database.postgresql.deploy=true \
  --set database.postgresql.auth.password=SECURE_PASSWORD \
  --set server.replicaCount=3 \
  --set app.replicaCount=3
```

### With Ingress and TLS

```bash
helm install kubelens kubelens/kubelens \
  --namespace kubelens \
  --create-namespace \
  --set ingress.enabled=true \
  --set ingress.className=nginx \
  --set ingress.hosts[0].host=kubelens.example.com \
  --set ingress.tls[0].secretName=kubelens-tls \
  --set ingress.tls[0].hosts[0]=kubelens.example.com
```

---

**Version**: 1.0.0  
**Last Updated**: November 6, 2025  
**Maintained By**: Kubelens Team

