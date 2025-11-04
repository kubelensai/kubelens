# Kubelens Server Helm Chart

This chart deploys the Kubelens Server, which can be installed **standalone** or as part of the parent Kubelens chart.

## Features

- ✅ **Standalone Deployment** - Can be deployed independently without app or dex
- ✅ **Multiple Database Support** - SQLite, PostgreSQL, or MySQL
- ✅ **Built-in or External Databases** - Deploy databases or use external services
- ✅ **Auto-configured DSN** - Database connection automatically configured
- ✅ **RBAC Support** - Kubernetes RBAC for cluster access
- ✅ **Ingress Support** - Optional ingress for external access

## Quick Start

### Standalone Installation (SQLite)

```bash
helm install kubelens-server ./charts/kubelens/charts/server
```

### With PostgreSQL (Built-in)

```bash
helm install kubelens-server ./charts/kubelens/charts/server \
  --set database.type=postgresql \
  --set database.postgresql.deploy=true \
  --set database.postgresql.builtin.auth.password=your-password
```

### With External MySQL

```bash
helm install kubelens-server ./charts/kubelens/charts/server \
  --set database.type=mysql \
  --set database.mysql.external.host=mysql.example.com \
  --set database.mysql.external.password=your-password
```

## Database Configuration

### SQLite (Default)

**Built-in with PVC:**
```yaml
database:
  type: sqlite
  sqlite:
    enabled: true
    path: /data/kubelens.db
    persistence:
      enabled: true
      size: 1Gi
```

**External (e.g., Cloudflare D1):**
```yaml
database:
  type: sqlite
  sqlite:
    enabled: false
    externalDSN: "file:/path/to/db.db?cache=shared&mode=rwc"
```

### PostgreSQL

**Built-in (Bitnami sub-chart):**
```yaml
database:
  type: postgresql
  postgresql:
    deploy: true
    builtin:
      auth:
        password: your-password
      primary:
        persistence:
          size: 10Gi
```

**External (AWS RDS, Google Cloud SQL, etc.):**
```yaml
database:
  type: postgresql
  postgresql:
    deploy: false
    external:
      host: postgres.example.com
      port: 5432
      database: kubelens
      username: kubelens
      password: your-password
      sslMode: require
```

**External (Full DSN):**
```yaml
database:
  type: postgresql
  postgresql:
    deploy: false
    external:
      dsn: "host=postgres.example.com port=5432 user=kubelens password=secret dbname=kubelens sslmode=require"
```

### MySQL

**Built-in (Bitnami sub-chart):**
```yaml
database:
  type: mysql
  mysql:
    deploy: true
    builtin:
      auth:
        password: your-password
      primary:
        persistence:
          size: 10Gi
```

**External (AWS RDS, Google Cloud SQL, etc.):**
```yaml
database:
  type: mysql
  mysql:
    deploy: false
    external:
      host: mysql.example.com
      port: 3306
      database: kubelens
      username: kubelens
      password: your-password
```

## Configuration

### Essential Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `replicaCount` | Number of replicas | `1` |
| `image.repository` | Server image repository | `kubelensai/kubelens-server` |
| `image.tag` | Server image tag | `""` (uses appVersion) |
| `adminPassword` | Admin user password | `""` (auto-generated) |
| `database.type` | Database type: sqlite, postgresql, mysql | `sqlite` |

### Database Parameters

#### SQLite

| Parameter | Description | Default |
|-----------|-------------|---------|
| `database.sqlite.enabled` | Use built-in SQLite | `true` |
| `database.sqlite.path` | Path to database file | `/data/kubelens.db` |
| `database.sqlite.externalDSN` | External DSN | `""` |
| `database.sqlite.persistence.enabled` | Enable persistence | `true` |
| `database.sqlite.persistence.size` | PVC size | `1Gi` |

#### PostgreSQL

| Parameter | Description | Default |
|-----------|-------------|---------|
| `database.postgresql.deploy` | Deploy PostgreSQL | `false` |
| `database.postgresql.external.host` | External host | `""` |
| `database.postgresql.external.password` | Password | `""` |
| `database.postgresql.builtin.auth.password` | Built-in password | `kubelens123` |
| `database.postgresql.builtin.primary.persistence.size` | PVC size | `10Gi` |

#### MySQL

| Parameter | Description | Default |
|-----------|-------------|---------|
| `database.mysql.deploy` | Deploy MySQL | `false` |
| `database.mysql.external.host` | External host | `""` |
| `database.mysql.external.password` | Password | `""` |
| `database.mysql.builtin.auth.password` | Built-in password | `kubelens123` |
| `database.mysql.builtin.primary.persistence.size` | PVC size | `10Gi` |

### Other Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `rateLimit.global` | Global rate limit (req/min) | `1000` |
| `rateLimit.login` | Login rate limit (req/min) | `5` |
| `ingress.enabled` | Enable ingress | `false` |
| `ingress.hosts` | Ingress hosts | `[api.kubelens.app]` |
| `serviceAccount.create` | Create service account | `true` |
| `rbac.create` | Create RBAC resources | `true` |

## Examples

### Production Setup with PostgreSQL HA

```bash
helm install kubelens-server ./charts/kubelens/charts/server \
  --set database.type=postgresql \
  --set database.postgresql.deploy=true \
  --set database.postgresql.builtin.auth.password=secure-password \
  --set database.postgresql.builtin.auth.postgresPassword=admin-password \
  --set database.postgresql.builtin.primary.persistence.size=50Gi \
  --set database.postgresql.builtin.primary.resources.requests.memory=1Gi \
  --set database.postgresql.builtin.primary.resources.requests.cpu=1000m \
  --set adminPassword=admin-secure-password \
  --set ingress.enabled=true \
  --set ingress.hosts[0].host=api.kubelens.example.com \
  --set resources.requests.memory=512Mi \
  --set resources.requests.cpu=500m
```

### Development Setup with SQLite

```bash
helm install kubelens-server-dev ./charts/kubelens/charts/server \
  --set database.sqlite.persistence.size=500Mi \
  --set resources.requests.memory=128Mi \
  --set resources.requests.cpu=100m
```

### Using External AWS RDS PostgreSQL

```bash
helm install kubelens-server ./charts/kubelens/charts/server \
  --set database.type=postgresql \
  --set database.postgresql.external.host=mydb.123456.us-east-1.rds.amazonaws.com \
  --set database.postgresql.external.database=kubelens \
  --set database.postgresql.external.username=kubelens \
  --set database.postgresql.external.password=aws-rds-password \
  --set database.postgresql.external.sslMode=require
```

### Using External Google Cloud SQL MySQL

```bash
helm install kubelens-server ./charts/kubelens/charts/server \
  --set database.type=mysql \
  --set database.mysql.external.host=10.1.2.3 \
  --set database.mysql.external.database=kubelens \
  --set database.mysql.external.username=kubelens \
  --set database.mysql.external.password=gcp-sql-password
```

## Upgrading

### Update Dependencies

```bash
helm dependency update
```

### Upgrade Release

```bash
helm upgrade kubelens-server ./charts/kubelens/charts/server \
  --reuse-values \
  --set database.postgresql.builtin.auth.password=new-password
```

## Troubleshooting

### View Logs

```bash
kubectl logs -f deployment/kubelens-server
```

### Check Database Connection

```bash
kubectl get secret kubelens-server-database -o jsonpath='{.data.dsn}' | base64 -d
```

### Verify Pod Status

```bash
kubectl get pods -l app.kubernetes.io/name=server
kubectl describe pod <pod-name>
```

### Test Health Endpoint

```bash
kubectl port-forward svc/kubelens-server 8080:8080
curl http://localhost:8080/health
```

### Database Issues

**PostgreSQL:**
```bash
kubectl get pods -l app.kubernetes.io/name=postgresql
kubectl logs -f statefulset/kubelens-server-postgresql
```

**MySQL:**
```bash
kubectl get pods -l app.kubernetes.io/name=mysql
kubectl logs -f statefulset/kubelens-server-mysql
```

## Uninstalling

```bash
helm uninstall kubelens-server
```

**Note:** This will not delete PVCs. To delete them:

```bash
kubectl delete pvc -l app.kubernetes.io/name=server
kubectl delete pvc -l app.kubernetes.io/name=postgresql
kubectl delete pvc -l app.kubernetes.io/name=mysql
```

## Resources

- [Parent Kubelens Chart](../../README.md)
- [Database Configuration Guide](../../DATABASE.md)
- [Bitnami PostgreSQL Chart](https://github.com/bitnami/charts/tree/main/bitnami/postgresql)
- [Bitnami MySQL Chart](https://github.com/bitnami/charts/tree/main/bitnami/mysql)
