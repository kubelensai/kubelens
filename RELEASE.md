# Release Process

This document describes the release process for Kubelens.

## Overview

Kubelens uses automated GitHub Actions workflows to manage releases. There are two main workflows:

1. **Draft Release** - Creates a draft release and version bump PR
2. **Release** - Builds, tests, and publishes the release

## Version Scheme

Kubelens follows [Semantic Versioning](https://semver.org/):

- **MAJOR.MINOR.PATCH** (e.g., `v1.2.3`)
- **MAJOR.MINOR.PATCH-prerelease.N** (e.g., `v1.2.3-beta.1`)

### Version Bumping

- **Patch** (`v1.0.0` → `v1.0.1`): Bug fixes, minor changes
- **Minor** (`v1.0.0` → `v1.1.0`): New features, backward compatible
- **Major** (`v1.0.0` → `v2.0.0`): Breaking changes
- **Prerelease**: Alpha, beta, or release candidate versions

## Quick Start

### Option 1: Automated Draft Release (Recommended)

1. Go to **Actions** → **Draft Release**
2. Click **Run workflow**
3. Select version bump type (patch/minor/major/prerelease)
4. Optionally select prerelease type (alpha/beta/rc)
5. Click **Run workflow**

This will:
- Calculate the new version
- Update version files
- Create a release branch
- Open a PR with the changes
- Create a draft GitHub release

6. Review and merge the PR
7. Create and push the release tag:
   ```bash
   git checkout main
   git pull
   git tag v1.0.0
   git push origin v1.0.0
   ```

8. The release workflow will automatically trigger

### Option 2: Manual Release

1. Update version numbers in:
   - `charts/kubelens/Chart.yaml`
   - `charts/kubelens/charts/server/Chart.yaml`
   - `charts/kubelens/charts/app/Chart.yaml`
   - `src/app/package.json`

2. Commit and push changes:
   ```bash
   git add -A
   git commit -m "chore: bump version to v1.0.0"
   git push origin main
   ```

3. Create and push the tag:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

4. The release workflow will automatically trigger

## Release Workflow Steps

When a tag is pushed, the release workflow will:

### 1. Validation ✅
- Validate version format
- Check if it's a prerelease
- Verify tag doesn't already exist

### 2. Build and Test 🧪
- Run Go backend tests with race detection
- Run frontend tests
- Build frontend application
- Upload code coverage

### 3. Build Docker Images 🐳
- Build multi-arch images (amd64, arm64)
- Push to Docker Hub
- Push to GitHub Container Registry
- Generate and upload SBOM (Software Bill of Materials)
- Use layer caching for faster builds

### 4. Security Scanning 🔒
- Scan all images with Trivy
- Upload results to GitHub Security
- Generate vulnerability reports
- Fail if critical vulnerabilities found

### 5. Package Helm Chart 📦
- Update chart versions
- Package Helm chart
- Upload as release artifact

### 6. Create GitHub Release 🚀
- Generate changelog from commits
- Create release (stable or prerelease)
- Attach Helm chart
- Attach SBOM files
- Attach security reports
- Add Docker pull commands

### 7. Notifications 📢
- Send Slack notification (if configured)
- Notify on success or failure

## Release Artifacts

Each release includes:

### Docker Images
- `kubelensai/kubelens-server:v1.0.0`
- `kubelensai/kubelens-app:v1.0.0`
- `kubelensai/kubelens-shell:v1.0.0`
- `ghcr.io/kubelensai/kubelens-server:v1.0.0`
- `ghcr.io/kubelensai/kubelens-app:v1.0.0`
- `ghcr.io/kubelensai/kubelens-shell:v1.0.0`

All images are multi-arch (linux/amd64, linux/arm64).

### Helm Chart
- `kubelens-1.0.0.tgz` - Packaged Helm chart

### Security Reports
- `sbom-server.spdx.json` - Server SBOM
- `sbom-app.spdx.json` - App SBOM
- `sbom-shell.spdx.json` - Shell SBOM
- `trivy-report-server.json` - Server vulnerability report
- `trivy-report-app.json` - App vulnerability report
- `trivy-report-shell.json` - Shell vulnerability report

## Prerelease Workflow

For alpha, beta, or RC releases:

1. Run **Draft Release** workflow
2. Select **prerelease** as version bump
3. Select prerelease type (alpha/beta/rc)
4. This creates a version like `v1.2.3-beta.1`

Prereleases:
- Are marked as "Pre-release" on GitHub
- Don't update the `latest` Docker tag
- Are useful for testing before stable release

## Manual Trigger

You can manually trigger a release:

1. Go to **Actions** → **Release Kubelens**
2. Click **Run workflow**
3. Enter the version (e.g., `v1.0.0`)
4. Click **Run workflow**

## Hotfix Releases

For urgent bug fixes:

1. Create a hotfix branch from the release tag:
   ```bash
   git checkout -b hotfix/v1.0.1 v1.0.0
   ```

2. Make your fixes and commit

3. Update version to patch (v1.0.0 → v1.0.1)

4. Merge to main:
   ```bash
   git checkout main
   git merge hotfix/v1.0.1
   ```

5. Tag and push:
   ```bash
   git tag v1.0.1
   git push origin v1.0.1
   ```

## Rollback

If a release has issues:

1. Delete the problematic release from GitHub
2. Delete the Docker images (if needed)
3. Fix the issues
4. Create a new patch release

## Configuration

### Required Secrets

Configure these in **Settings** → **Secrets and variables** → **Actions**:

- `DOCKERHUB_USERNAME` - Docker Hub username
- `DOCKERHUB_TOKEN` - Docker Hub access token
- `GITHUB_TOKEN` - Automatically provided by GitHub
- `CODECOV_TOKEN` (optional) - For code coverage reports
- `SLACK_WEBHOOK_URL` (optional) - For Slack notifications

### Environment Variables

Set in the workflow file:
- `SERVER_IMAGE` - Server Docker image name
- `APP_IMAGE` - App Docker image name
- `SHELL_IMAGE` - Shell Docker image name

## Best Practices

### Before Release
- ✅ All tests passing
- ✅ Code reviewed and approved
- ✅ Documentation updated
- ✅ Breaking changes documented
- ✅ Migration guide prepared (if needed)

### Version Selection
- **Patch**: Bug fixes, security patches
- **Minor**: New features, enhancements
- **Major**: Breaking changes, major refactoring
- **Prerelease**: Testing, early access

### Release Notes
- Use clear, descriptive commit messages
- Reference issue numbers in commits
- Group changes by type (Features, Bug Fixes, Breaking Changes)
- Include migration instructions for breaking changes

### Testing
- Test prereleases in staging environment
- Verify Helm chart installation
- Check Docker image sizes
- Review security scan results

## Troubleshooting

### Build Failed
- Check test results
- Review build logs
- Verify dependencies

### Security Scan Failed
- Review vulnerability report
- Update dependencies
- Create CVE exceptions if needed

### Docker Push Failed
- Verify Docker Hub credentials
- Check image size limits
- Review network connectivity

### Release Creation Failed
- Verify GitHub token permissions
- Check tag format
- Review workflow logs

## Support

For issues with the release process:
1. Check workflow run logs
2. Review this documentation
3. Open an issue on GitHub
4. Contact the maintainers

## References

- [Semantic Versioning](https://semver.org/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Helm Chart Best Practices](https://helm.sh/docs/chart_best_practices/)

