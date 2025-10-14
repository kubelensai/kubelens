.PHONY: help build run test clean docker-build docker-push helm-install helm-uninstall

help:
	@echo "kubelens - Multi-Cluster Kubernetes Dashboard"
	@echo ""
	@echo "Available targets:"
	@echo "  build          - Build server and app"
	@echo "  run            - Run server and app in development mode"
	@echo "  test           - Run tests"
	@echo "  clean          - Clean build artifacts"
	@echo "  docker-build   - Build Docker images"
	@echo "  docker-push    - Push Docker images"
	@echo "  docker-up      - Start with docker-compose"
	@echo "  docker-down    - Stop docker-compose"
	@echo "  helm-install   - Install Helm chart"
	@echo "  helm-uninstall - Uninstall Helm chart"

# Server
build-server:
	@echo "Building server..."
	cd src/server && go build -o ../../bin/server ./cmd/server

run-server:
	@echo "Running server..."
	cd src/server && go run ./cmd/server/main.go

test-server:
	@echo "Testing server..."
	cd src/server && go test ./...

# App
build-app:
	@echo "Building app..."
	cd src/app && npm run build

run-app:
	@echo "Running app..."
	cd src/app && npm run dev

install-app:
	@echo "Installing app dependencies..."
	cd src/app && npm install

# Combined
build: build-server build-app

run:
	@echo "Starting development servers..."
	@echo "Server: http://localhost:8080"
	@echo "App: http://localhost:5173"
	@make -j2 run-server run-app

test: test-server

clean:
	@echo "Cleaning..."
	rm -rf bin
	rm -rf src/server/bin
	rm -rf src/app/dist
	rm -rf src/app/node_modules
	rm -rf data/*.db

# Docker
docker-build:
	@echo "Building Docker images..."
	cd docker && docker build -f Dockerfile.server -t kubelens/server:latest ..
	cd docker && docker build -f Dockerfile.app -t kubelens/app:latest ..

docker-push:
	@echo "Pushing Docker images..."
	docker push kubelens/server:latest
	docker push kubelens/app:latest

docker-up:
	@echo "Starting with docker-compose..."
	cd docker && docker-compose up -d

docker-down:
	@echo "Stopping docker-compose..."
	cd docker && docker-compose down

docker-logs:
	cd docker && docker-compose logs -f

# Helm
helm-install:
	@echo "Installing Helm chart..."
	helm install kubelens ./charts/kubelens -n kubelens --create-namespace

helm-upgrade:
	@echo "Upgrading Helm chart..."
	helm upgrade kubelens ./charts/kubelens -n kubelens

helm-uninstall:
	@echo "Uninstalling Helm chart..."
	helm uninstall kubelens -n kubelens

helm-template:
	@echo "Rendering Helm templates..."
	helm template kubelens ./charts/kubelens

# Development
dev-setup:
	@echo "Setting up development environment..."
	@make install-app
	mkdir -p data
	mkdir -p config
	cp config/config.example.yaml config/config.yaml || true
	@echo "Setup complete! Edit config/config.yaml and run 'make run'"

# Go mod
mod-download:
	@echo "Downloading Go modules..."
	cd src/server && go mod download

mod-tidy:
	@echo "Tidying Go modules..."
	cd src/server && go mod tidy
