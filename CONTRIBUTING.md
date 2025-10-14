# Contributing to Kubelens

Thank you for your interest in contributing to Kubelens! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct. Please be respectful and constructive in all interactions.

## How to Contribute

### Reporting Bugs

Before creating a bug report:
- Check the [issue tracker](https://github.com/yourusername/kubelens/issues) to see if the bug has already been reported
- Update to the latest version to see if the bug still exists

When creating a bug report, include:
- **Title**: Clear and descriptive title
- **Description**: Detailed description of the bug
- **Steps to Reproduce**: Step-by-step instructions
- **Expected Behavior**: What you expected to happen
- **Actual Behavior**: What actually happened
- **Environment**: OS, Go version, Node version, Kubernetes version
- **Logs**: Relevant error messages or logs
- **Screenshots**: If applicable

### Suggesting Features

Before suggesting a feature:
- Check the [issue tracker](https://github.com/yourusername/kubelens/issues) for similar suggestions
- Consider if the feature aligns with the project's goals

When suggesting a feature, include:
- **Title**: Clear and descriptive title
- **Description**: Detailed description of the feature
- **Use Case**: Why this feature would be useful
- **Alternatives**: Any alternative solutions you've considered
- **Additional Context**: Any other relevant information

### Pull Requests

1. **Fork the Repository**
   ```bash
   git clone https://github.com/yourusername/kubelens.git
   cd kubelens
   ```

2. **Create a Branch**
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```

3. **Make Your Changes**
   - Follow the coding standards (see below)
   - Write clear, concise commit messages
   - Add tests if applicable
   - Update documentation if needed

4. **Test Your Changes**
   ```bash
   # Server tests
   cd src/server
   go test ./...
   
   # App tests
   cd src/app
   npm test
   
   # Build and run
   cd ../..
   ./scripts/dev.sh restart
   ```

5. **Commit Your Changes**
   ```bash
   git add .
   git commit -m "feat: add amazing feature"
   ```
   
   Follow [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat`: New feature
   - `fix`: Bug fix
   - `docs`: Documentation changes
   - `style`: Code style changes (formatting, etc.)
   - `refactor`: Code refactoring
   - `test`: Adding or updating tests
   - `chore`: Maintenance tasks

6. **Push to Your Fork**
   ```bash
   git push origin feature/your-feature-name
   ```

7. **Create a Pull Request**
   - Go to the [original repository](https://github.com/yourusername/kubelens)
   - Click "New Pull Request"
   - Select your fork and branch
   - Fill in the PR template
   - Link any related issues

### Pull Request Guidelines

- **Title**: Use a clear, descriptive title following Conventional Commits
- **Description**: Explain what changes you made and why
- **Testing**: Describe how you tested your changes
- **Screenshots**: Include screenshots for UI changes
- **Documentation**: Update relevant documentation
- **Breaking Changes**: Clearly mark any breaking changes

## Development Setup

### Prerequisites

- Go 1.24+
- Node.js 20+
- Docker & Docker Compose
- Git

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/kubelens.git
   cd kubelens
   ```

2. **Start development environment**
   ```bash
   ./scripts/dev.sh start
   ```

3. **Access the application**
   - App: http://localhost
   - API: http://localhost:8080

### Project Structure

```
kubelens/
├── src/
│   ├── server/          # Go server
│   │   ├── cmd/
│   │   ├── internal/
│   │   └── go.mod
│   └── app/             # React app
│       ├── src/
│       └── package.json
├── docker/              # Docker files
├── charts/              # Helm charts
└── scripts/             # Utility scripts
```

## Coding Standards

### Go (Server)

- Follow [Effective Go](https://golang.org/doc/effective_go)
- Use `gofmt` for formatting
- Run `go vet` before committing
- Write meaningful comments for exported functions
- Keep functions small and focused
- Use meaningful variable and function names

```bash
cd src/server
go fmt ./...
go vet ./...
go test ./...
```

### TypeScript/React (App)

- Follow [Airbnb React Style Guide](https://airbnb.io/javascript/react/)
- Use TypeScript for type safety
- Use functional components with hooks
- Keep components small and focused
- Use meaningful component and variable names
- Write JSDoc comments for complex functions

```bash
cd src/app
npm run lint
npm run build
```

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Refactoring
- `test`: Tests
- `chore`: Maintenance

**Examples:**
```
feat(pods): add real-time pod logs streaming

Add WebSocket-based log streaming for pods with follow mode.
Includes automatic reconnection and error handling.

Closes #123
```

```
fix(deployments): correct replica count display

The replica count was showing incorrect values when pods were in
different states. Fixed by aggregating all pod states correctly.

Fixes #456
```

## Testing

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

### Manual Testing

1. Start the development environment
2. Test the specific feature you changed
3. Verify existing features still work
4. Test in different browsers if UI changes
5. Test with different cluster configurations

## Documentation

When adding new features:
- Update README.md if needed
- Add inline code comments
- Update API documentation
- Add examples if applicable
- Update Helm chart documentation

## Release Process

Maintainers will handle releases. The process includes:
1. Update version numbers
2. Update CHANGELOG.md
3. Create a git tag
4. Build and push Docker images
5. Publish Helm charts
6. Create GitHub release

## Getting Help

- **Documentation**: Check the [README](README.md)
- **Issues**: Search [existing issues](https://github.com/yourusername/kubelens/issues)
- **Discussions**: Join [GitHub Discussions](https://github.com/yourusername/kubelens/discussions)

## License

By contributing to Kubelens, you agree that your contributions will be licensed under the [MIT License](LICENSE).

## Recognition

Contributors will be recognized in:
- GitHub contributors list
- Release notes for significant contributions
- Special mentions for exceptional contributions

Thank you for contributing to Kubelens! 🎉
