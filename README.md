# Kubelens 🔍

<div align="center">

![Kubelens Logo](https://via.placeholder.com/150x150/465fff/ffffff?text=K)

**A modern, production-ready multi-cluster Kubernetes dashboard**

[![Build Status](https://img.shields.io/github/actions/workflow/status/yourusername/kubelens/ci.yml?branch=main)](https://github.com/yourusername/kubelens/actions)
[![Docker Pulls](https://img.shields.io/docker/pulls/kubelens/server)](https://hub.docker.com/r/kubelens/server)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Go Version](https://img.shields.io/badge/go-1.24+-00ADD8.svg)](https://golang.org)
[![Node Version](https://img.shields.io/badge/node-20+-339933.svg)](https://nodejs.org)

[Features](#-features) • [Quick Start](#-quick-start) • [Documentation](#-documentation) • [Contributing](#-contributing)

</div>

---
## 📖 Overview

Kubelens is a powerful, user-friendly Kubernetes dashboard designed for DevOps teams managing multiple clusters. Built with modern technologies and best practices, it provides real-time insights, comprehensive resource management, and an intuitive interface for Kubernetes operations.

## ✨ Features

### 🎯 Core Features

- **🌐 Multi-Cluster Management**
  - Connect unlimited Kubernetes clusters
  - Switch between clusters seamlessly
  - Import clusters via server URL, CA certificate, and token
  - Enable/disable clusters dynamically
  - Per-cluster metrics and health monitoring

- **📊 Comprehensive Resource Management**
  - **Workloads**: Pods, Deployments, DaemonSets, StatefulSets, ReplicaSets, Jobs, CronJobs
  - **Network**: Services, Endpoints, Ingresses, Ingress Classes, Network Policies
  - **Config & Storage**: ConfigMaps, Secrets, PVCs, PVs, Storage Classes
  - **Access Control**: Service Accounts, Roles, Cluster Roles, Role Bindings, Cluster Role Bindings
  - **Autoscaling**: Horizontal Pod Autoscalers (HPAs), Pod Disruption Budgets (PDBs)
  - **Advanced**: Priority Classes, Runtime Classes, Leases, Webhook Configurations
  - **Custom Resources**: Full CRD support with dynamic pages

- **🔄 Real-Time Updates**
  - WebSocket-based live updates
  - Auto-refresh for all resource lists
  - Real-time metrics from metrics-server
  - Live pod logs and shell access

- **🎨 Modern UI/UX**
  - Beautiful, responsive design with dark/light themes
  - Resizable table columns
  - Advanced search and filtering
  - Sortable columns with multi-field support
  - Pagination with configurable page sizes
  - Collapsible sidebar with groups
  - Notification center with action history

- **🔧 Resource Operations**
  - **View**: Detailed resource information with YAML preview
  - **Edit**: YAML editor with syntax highlighting (Monaco Editor)
  - **Create**: Form-based and YAML-based resource creation
  - **Delete**: Safe deletion with confirmation
  - **Scale**: Scale deployments, statefulsets, replicasets
  - **Restart**: Restart deployments and pods
  - **Shell**: Interactive terminal access to pods (xterm.js)
  - **Logs**: Real-time pod logs viewing

- **📈 Metrics & Monitoring**
  - Node metrics (CPU, Memory, Storage)
  - Pod metrics with usage graphs
  - Cluster-wide resource aggregation
  - Health status indicators
  - TLS certificate information for secrets

- **🔍 Advanced Features**
  - **Dynamic CRD Pages**: Automatically discover and display custom resources
  - **Namespace Filtering**: Filter resources by namespace across all pages
  - **Cluster Switching**: Quick cluster switcher in the header
  - **Breadcrumb Navigation**: Always know where you are
  - **Responsive Tables**: All columns are resizable and sortable
  - **Smart Tooltips**: Hover or click for detailed information

## 🏗️ Architecture

### Tech Stack

**Server (Go)**
- Go 1.24+ with Gin framework
- Kubernetes client-go for cluster communication
- SQLite for configuration persistence
- WebSocket support for real-time updates
- RESTful API with comprehensive endpoints

**App (React)**
- React 18+ with TypeScript
- Vite for fast builds and HMR
- TailwindCSS for beautiful UI
- React Query (TanStack Query) for data fetching
- Zustand for state management
- Monaco Editor for YAML editing
- xterm.js for terminal access
- Heroicons for icons

**Infrastructure**
- Docker & Docker Compose for containerization
- Helm charts for Kubernetes deployment
- GitHub Actions for CI/CD
- Multi-architecture support (amd64, arm64)

### Components

```
┌────────────────────────────────────────────────────────────────┐
│                   App (React + TypeScript)                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │Dashboard │  │Workloads │  │ Network  │  │  Config  │      │
│  │          │  │  • Pods  │  │ •Services│  │•ConfigMap│      │
│  │ • Overview│  │•Deploys  │  │•Ingress  │  │ •Secrets │      │
│  │ • Metrics│  │•DaemonSet│  │•Endpoints│  │  • HPAs  │      │
│  │ • Nodes  │  │•StatefulS│  │ •NetPol  │  │  • PDBs  │      │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘      │
└────────────────────────────────────────────────────────────────┘
                              │
                    REST API / WebSocket
                              ▼
┌────────────────────────────────────────────────────────────────┐
│                      Server API (Go)                           │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │          Multi-Cluster Manager (SQLite DB)               │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │ │
│  │  │  Cluster 1  │  │  Cluster 2  │  │  Cluster N  │      │ │
│  │  │ Production  │  │   Staging   │  │     Dev     │      │ │
│  │  │   Status: ✓ │  │   Status: ✓ │  │   Status: ✓ │      │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘      │ │
│  └──────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
                              │
                    Kubernetes API (client-go)
                              ▼
┌────────────────────────────────────────────────────────────────┐
│           Kubernetes Clusters (Production, Staging, Dev)       │
│  • Workloads  • Network  • Storage  • RBAC  • CRDs            │
└────────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- **Go**: 1.24 or higher
- **Node.js**: 20+ and npm
- **Docker**: Latest version (optional, for containerized deployment)
- **Kubernetes**: One or more clusters with kubeconfig access
- **kubectl**: For Kubernetes CLI operations (optional)

### Option 1: Local Development (Recommended for Development)

#### 1. Clone the repository

```bash
git clone https://github.com/yourusername/kubelens.git
cd kubelens
```

#### 2. Start with development script

```bash
./scripts/dev.sh start
```

This will:
- Build and start both server and app containers
- Server runs on `http://localhost:8080`
- App runs on `http://localhost`

#### 3. Access Kubelens

Open your browser and navigate to:
- **App**: http://localhost
- **API**: http://localhost:8080/api/v1/health

### Option 2: Docker Compose (Quick & Easy)

```bash
cd docker
docker-compose up -d
```

### Option 3: Build from Source

#### Server

```bash
cd src/server
go mod download
go build -o ../../bin/kubelens-server ./cmd/server
../../bin/kubelens-server
```

The server API will start on `http://localhost:8080`

#### App

```bash
cd src/app
npm install
npm run dev
```

The app will start on `http://localhost:5173`

### Option 4: Helm Deployment (Production)

```bash
# Add Helm repository (if published)
helm repo add kubelens https://kubelens.github.io/charts
helm repo update

# Install Kubelens
helm install kubelens kubelens/kubelens \
  --namespace kubelens \
  --create-namespace \
  --set server.image.tag=latest \
  --set app.image.tag=latest

# Or from local charts
cd charts/kubelens
helm dependency build
helm install kubelens . -n kubelens --create-namespace
```

## 📝 Configuration

### Adding Clusters

Kubelens supports multiple ways to add Kubernetes clusters:

#### 1. Via Web UI (Recommended)

1. Navigate to **Cluster Management** page
2. Click **Import Cluster**
3. Fill in the form:
   - **Cluster Name**: A friendly name for your cluster
   - **Server**: Kubernetes API server URL (e.g., `https://api.cluster.example.com`)
   - **CA Certificate**: Base64-encoded CA certificate
   - **Token**: Service account token with appropriate permissions
4. Click **Import**

#### 2. Via API

```bash
curl -X POST http://localhost:8080/api/v1/clusters \
  -H "Content-Type: application/json" \
  -d '{
    "name": "production",
    "server": "https://api.prod.example.com",
    "ca": "LS0tLS1CRUdJTi...",
    "token": "ZXlKaGJHY2lPaUpTVXpJMU5pSXNJbX...",
    "is_default": true,
    "enabled": true
  }'
```

#### 3. Database Configuration

Clusters are stored in SQLite database (`data/kubelens.db`). You can manually edit the database if needed.

### Environment Variables

Configure the server using environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server API port | `8080` |
| `DATABASE_PATH` | SQLite database path | `/data/kubelens.db` |
| `LOG_LEVEL` | Logging level (debug, info, warn, error) | `info` |
| `CORS_ORIGINS` | Allowed CORS origins | `http://localhost,http://localhost:80` |

#### Docker Compose Example

```yaml
services:
  server:
    image: kubelens/server:latest
    environment:
      - PORT=8080
      - DATABASE_PATH=/data/kubelens.db
      - LOG_LEVEL=info
      - CORS_ORIGINS=http://localhost,http://app.example.com
    volumes:
      - ./data:/data
```

#### Helm Values Example

```yaml
server:
  env:
    PORT: "8080"
    DATABASE_PATH: "/data/kubelens.db"
    LOG_LEVEL: "info"
    CORS_ORIGINS: "http://localhost,http://app.example.com"
  
  persistence:
    enabled: true
    size: 5Gi
```

### RBAC Requirements

For full functionality, the service account token used to connect clusters should have these permissions:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: kubelens-viewer
rules:
  # Core resources
  - apiGroups: [""]
    resources: ["*"]
    verbs: ["get", "list", "watch"]
  
  # Apps
  - apiGroups: ["apps"]
    resources: ["*"]
    verbs: ["get", "list", "watch", "update", "patch", "delete"]
  
  # Batch
  - apiGroups: ["batch"]
    resources: ["*"]
    verbs: ["get", "list", "watch", "update", "patch", "delete"]
  
  # Networking
  - apiGroups: ["networking.k8s.io"]
    resources: ["*"]
    verbs: ["get", "list", "watch", "update", "patch", "delete"]
  
  # Storage
  - apiGroups: ["storage.k8s.io"]
    resources: ["*"]
    verbs: ["get", "list", "watch"]
  
  # RBAC
  - apiGroups: ["rbac.authorization.k8s.io"]
    resources: ["*"]
    verbs: ["get", "list", "watch"]
  
  # Autoscaling
  - apiGroups: ["autoscaling"]
    resources: ["*"]
    verbs: ["get", "list", "watch", "update", "patch"]
  
  # Policy
  - apiGroups: ["policy"]
    resources: ["*"]
    verbs: ["get", "list", "watch"]
  
  # Custom Resources
  - apiGroups: ["apiextensions.k8s.io"]
    resources: ["customresourcedefinitions"]
    verbs: ["get", "list", "watch"]
  
  # Metrics
  - apiGroups: ["metrics.k8s.io"]
    resources: ["*"]
    verbs: ["get", "list"]
```

## 📚 Documentation

### API Endpoints

The server exposes a comprehensive REST API:

#### Cluster Management
- `GET /api/v1/clusters` - List all clusters
- `GET /api/v1/clusters?enabled=true` - List enabled clusters only
- `POST /api/v1/clusters` - Add a new cluster
- `PUT /api/v1/clusters/:name` - Update cluster configuration
- `PUT /api/v1/clusters/:name/enabled` - Enable/disable a cluster
- `DELETE /api/v1/clusters/:name` - Delete a cluster
- `GET /api/v1/clusters/:name/metrics` - Get cluster metrics

#### Workloads
- `GET /api/v1/clusters/:name/pods` - List pods (all namespaces)
- `GET /api/v1/clusters/:name/namespaces/:namespace/pods` - List pods in namespace
- `GET /api/v1/clusters/:name/namespaces/:namespace/pods/:pod` - Get pod details
- `DELETE /api/v1/clusters/:name/namespaces/:namespace/pods/:pod` - Delete pod
- `POST /api/v1/clusters/:name/namespaces/:namespace/pods/:pod/evict` - Evict pod
- Similar endpoints for: deployments, daemonsets, statefulsets, replicasets, jobs, cronjobs

#### Network
- Endpoints for: services, endpoints, ingresses, ingressclasses, networkpolicies

#### Config & Storage
- Endpoints for: configmaps, secrets, pvcs, pvs, storageclasses

#### Access Control
- Endpoints for: serviceaccounts, roles, clusterroles, rolebindings, clusterrolebindings

#### Custom Resources
- `GET /api/v1/clusters/:name/customresourcedefinitions` - List CRDs
- `GET /api/v1/clusters/:name/customresources/:group/:version/:resource` - List custom resources
- Dynamic CRUD operations for all custom resources

#### WebSocket
- `WS /api/v1/ws` - WebSocket endpoint for real-time updates

### Development Commands

```bash
# Development
./scripts/dev.sh start      # Start services
./scripts/dev.sh stop       # Stop services
./scripts/dev.sh restart    # Restart services
./scripts/dev.sh status     # Show status
./scripts/dev.sh logs       # View logs
./scripts/dev.sh logs server  # Server logs only
./scripts/dev.sh logs app     # App logs only

# Build
make build                  # Build server and app
make build-server           # Build server only
make build-app              # Build app only

# Docker
make docker-build           # Build Docker images
make docker-push            # Push to registry
make docker-up              # Start with docker-compose
make docker-down            # Stop docker-compose
make docker-logs            # View logs

# Helm
make helm-install           # Install chart
make helm-upgrade           # Upgrade release
make helm-uninstall         # Uninstall release
make helm-template          # Render templates

# Testing
make test                   # Run all tests
make test-server            # Server tests only
cd src/app && npm test      # App tests
```

## 🏢 Project Structure

```
kubelens/
├── src/                           # Source code root
│   ├── server/                    # Go server
│   │   ├── cmd/
│   │   │   └── server/            # Main entry point
│   │   │       └── main.go
│   │   ├── internal/
│   │   │   ├── api/               # API handlers
│   │   │   │   ├── handler.go
│   │   │   │   ├── metrics.go
│   │   │   │   ├── node_metrics.go
│   │   │   │   ├── pod_actions.go
│   │   │   │   └── pod_metrics.go
│   │   │   ├── cluster/           # Cluster management
│   │   │   │   ├── manager.go
│   │   │   │   └── resources.go
│   │   │   ├── config/            # Configuration
│   │   │   │   └── config.go
│   │   │   ├── db/                # Database operations
│   │   │   │   └── db.go
│   │   │   └── ws/                # WebSocket handlers
│   │   │       ├── hub.go
│   │   │       └── client.go
│   │   ├── go.mod
│   │   └── go.sum
│   │
│   └── app/                       # React app
│       ├── src/
│       │   ├── components/        # React components (organized by feature)
│       │   │   ├── Pods/
│       │   │   ├── Deployments/
│       │   │   ├── Services/
│       │   │   └── shared/        # Shared components
│       │   ├── pages/             # Page components
│       │   ├── services/          # API services
│       │   ├── hooks/             # Custom hooks
│       │   ├── stores/            # Zustand stores
│       │   ├── types/             # TypeScript types
│       │   └── utils/             # Utility functions
│       ├── public/
│       ├── package.json
│       └── vite.config.ts
│
├── docker/                        # Docker files
│   ├── Dockerfile.server
│   ├── Dockerfile.app
│   ├── docker-compose.yml
│   └── nginx.conf
│
├── charts/                        # Helm charts
│   └── kubelens/
│       ├── Chart.yaml
│       ├── values.yaml
│       ├── charts/
│       │   ├── server/            # Server sub-chart
│       │   └── app/               # App sub-chart
│       └── templates/
│
├── scripts/                       # Utility scripts
│   ├── dev.sh                     # Development script
│   └── build.sh                   # Build script
│
├── .github/                       # GitHub Actions
│   └── workflows/
│       ├── ci.yml                 # CI pipeline
│       └── docker-build.yml       # Docker build & push
│
├── data/                          # Data directory (SQLite DB)
├── Makefile                       # Make commands
└── README.md
```

## 🧪 Testing

### Server Tests

```bash
cd src/server
go test -v -race -coverprofile=coverage.out ./...
go tool cover -html=coverage.out
```

### App Tests

```bash
cd src/app
npm test
npm run test:coverage
```

### Integration Tests

```bash
# Start services
./scripts/dev.sh start

# Run integration tests
# TODO: Add integration test suite
```

## 🐳 Docker Images

Pre-built Docker images are available on Docker Hub:

- **Server**: `kubelens/server:latest`
- **App**: `kubelens/app:latest`

Multi-architecture support:
- `linux/amd64`
- `linux/arm64`

### Building Custom Images

```bash
# Build for current platform
docker build -f docker/Dockerfile.server -t kubelens/server:custom .
docker build -f docker/Dockerfile.app -t kubelens/app:custom .

# Build for multiple platforms
docker buildx build --platform linux/amd64,linux/arm64 \
  -f docker/Dockerfile.server \
  -t kubelens/server:custom \
  --push .
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style

- **Go**: Follow [Effective Go](https://golang.org/doc/effective_go) guidelines
- **TypeScript/React**: Follow [Airbnb React Style Guide](https://airbnb.io/javascript/react/)
- Run linters before committing:
  ```bash
  cd src/server && go fmt ./... && go vet ./...
  cd src/app && npm run lint
  ```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Inspired by [Kubewall](https://github.com/kubewall/kubewall)
- Built with [client-go](https://github.com/kubernetes/client-go)
- UI powered by [React](https://react.dev) and [TailwindCSS](https://tailwindcss.com)
- Terminal powered by [xterm.js](https://xtermjs.org)
- Editor powered by [Monaco Editor](https://microsoft.github.io/monaco-editor/)

## 🔗 Links

- **Documentation**: [https://kubelens.github.io/docs](https://kubelens.github.io/docs)
- **Docker Hub**: [https://hub.docker.com/u/kubelens](https://hub.docker.com/u/kubelens)
- **Helm Charts**: [https://kubelens.github.io/charts](https://kubelens.github.io/charts)
- **Issue Tracker**: [GitHub Issues](https://github.com/yourusername/kubelens/issues)

## 📞 Support

- **Documentation**: Check our [docs](https://kubelens.github.io/docs)
- **Issues**: Report bugs via [GitHub Issues](https://github.com/yourusername/kubelens/issues)
- **Discussions**: Join our [GitHub Discussions](https://github.com/yourusername/kubelens/discussions)

---

<div align="center">

**Made with ❤️ by the Kubelens Team**

[⬆ Back to Top](#kubelens-)

</div>
