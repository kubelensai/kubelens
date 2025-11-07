# Kubelens Helm Chart Repository

This is the official Helm chart repository for Kubelens.

## Usage

Add this Helm repository:

```bash
helm repo add kubelens https://kubelensai.github.io/kubelens
helm repo update
```

Install Kubelens:

```bash
helm install kubelens kubelens/kubelens
```

## Available Charts

- **kubelens** - Multi-Cluster Kubernetes Dashboard

## OCI Registry (Alternative)

You can also install directly from OCI registries:

### GitHub Container Registry

```bash
helm install kubelens oci://ghcr.io/kubelensai/charts/kubelens --version VERSION
```

### Docker Hub

```bash
helm install kubelens oci://kubelensai/charts/kubelens --version VERSION
```
