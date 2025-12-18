#!/bin/bash

# Kubelens Development & Testing Script - Main Wrapper
# Redirects to specific database scripts in scripts/ directory
# For direct usage, use scripts/dev.sqlite.sh, scripts/dev.postgres.sh, or scripts/dev.mysql.sh

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Functions
print_header() {
    echo -e "${CYAN}╔═══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║                                                                   ║${NC}"
    echo -e "${CYAN}║             🚀 Kubelens Development Script 🚀                    ║${NC}"
    echo -e "${CYAN}║                                                                   ║${NC}"
    echo -e "${CYAN}╚═══════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

show_help() {
    print_header
    echo "Usage: ./dev.sh [command] [database]"
    echo ""
    echo "Commands:"
    echo "  up [db]       - Start services with specified database"
    echo "  down [db]     - Stop services with specified database"
    echo "  restart [db]  - Restart services with specified database"
    echo "  logs [db]     - View logs for specified database setup"
    echo "  build         - Build Docker images"
    echo "  clean [db]    - Clean up containers and volumes"
    echo "  test [db]     - Run tests with specified database"
    echo "  shell         - Open shell in server container"
    echo "  db-shell [db] - Open database shell"
    echo "  status [db]   - Show status of services"
    echo "  help          - Show this help message"
    echo ""
    echo "Databases:"
    echo "  sqlite        - Use SQLite (default, no external DB)"
    echo "  postgres      - Use PostgreSQL"
    echo "  mysql         - Use MySQL"
    echo "  all           - Test all databases sequentially"
    echo ""
    echo "Examples:"
    echo "  ./dev.sh up sqlite          # Start with SQLite"
    echo "  ./dev.sh up postgres        # Start with PostgreSQL"
    echo "  ./dev.sh logs mysql         # View MySQL logs"
    echo "  ./dev.sh test all           # Test all databases"
    echo "  ./dev.sh down postgres      # Stop PostgreSQL setup"
    echo ""
}

get_compose_file() {
    local db=$1
    case $db in
        sqlite)
            echo "docker-compose.sqlite.yml"
            ;;
        postgres|postgresql)
            echo "docker-compose.postgres.yml"
            ;;
        mysql)
            echo "docker-compose.mysql.yml"
            ;;
        *)
            print_error "Unknown database: $db"
            echo "Available: sqlite, postgres, mysql"
            exit 1
            ;;
    esac
}

start_services() {
    local db=${1:-sqlite}
    local compose_file=$(get_compose_file "$db")
    
    print_info "Starting Kubelens with $db..."
    echo ""
    
    docker-compose -f "$compose_file" up -d
    
    echo ""
    print_success "Services started!"
    echo ""
    print_info "Service URLs:"
    echo "  🌐 Frontend:  http://localhost:3000"
    echo "  🔧 API:       http://localhost:8080"
    echo "  📊 Health:    http://localhost:8080/health"
    
    if [ "$db" = "postgres" ]; then
        echo "  🐘 PostgreSQL: localhost:5432 (kubelens/kubelens123)"
        echo "  🔍 pgAdmin:    http://localhost:5050 (admin@kubelens.local/admin123)"
        echo "               (run with: docker-compose -f $compose_file --profile tools up -d)"
    elif [ "$db" = "mysql" ]; then
        echo "  🐬 MySQL:      localhost:3306 (kubelens/kubelens123)"
        echo "  🔍 phpMyAdmin: http://localhost:8081 (kubelens/kubelens123)"
        echo "               (run with: docker-compose -f $compose_file --profile tools up -d)"
    fi
    
    echo ""
    print_info "Default credentials:"
    echo "  Username: admin"
    echo "  Password: admin123"
    echo ""
    print_info "View logs: ./dev.sh logs $db"
}

stop_services() {
    local db=${1:-sqlite}
    local compose_file=$(get_compose_file "$db")
    
    print_info "Stopping Kubelens ($db)..."
    docker-compose -f "$compose_file" down
    print_success "Services stopped!"
}

restart_services() {
    local db=${1:-sqlite}
    stop_services "$db"
    echo ""
    start_services "$db"
}

show_logs() {
    local db=${1:-sqlite}
    local compose_file=$(get_compose_file "$db")
    local service=${2:-}
    
    if [ -z "$service" ]; then
        docker-compose -f "$compose_file" logs -f
    else
        docker-compose -f "$compose_file" logs -f "$service"
    fi
}

build_images() {
    print_info "Building Docker images..."
    echo ""
    
    print_info "Building server..."
    docker build -f Dockerfile.server -t kubelens/server:latest .
    
    print_info "Building app..."
    docker build -f Dockerfile.app -t kubelens/app:latest .
    
    print_success "Build complete!"
}

clean_services() {
    local db=${1:-all}
    
    if [ "$db" = "all" ]; then
        print_warning "Cleaning up all database setups..."
        docker-compose -f docker-compose.sqlite.yml down -v 2>/dev/null || true
        docker-compose -f docker-compose.postgres.yml down -v 2>/dev/null || true
        docker-compose -f docker-compose.mysql.yml down -v 2>/dev/null || true
    else
        local compose_file=$(get_compose_file "$db")
        print_warning "Cleaning up $db setup..."
        docker-compose -f "$compose_file" down -v
    fi
    
    print_success "Cleanup complete!"
}

run_tests() {
    local db=${1:-sqlite}
    
    if [ "$db" = "all" ]; then
        print_info "Testing all databases..."
        echo ""
        
        for test_db in sqlite postgres mysql; do
            print_info "Testing $test_db..."
            test_database "$test_db"
            echo ""
        done
        
        print_success "All database tests complete!"
    else
        test_database "$db"
    fi
}

test_database() {
    local db=$1
    local compose_file=$(get_compose_file "$db")
    
    print_info "Starting $db services..."
    docker-compose -f "$compose_file" up -d
    
    print_info "Waiting for services to be healthy..."
    sleep 10
    
    # Wait for health check
    local max_attempts=30
    local attempt=0
    while [ $attempt -lt $max_attempts ]; do
        if curl -sf http://localhost:8080/health > /dev/null 2>&1; then
            print_success "$db: Server is healthy!"
            break
        fi
        attempt=$((attempt + 1))
        echo -n "."
        sleep 2
    done
    echo ""
    
    if [ $attempt -eq $max_attempts ]; then
        print_error "$db: Health check timeout!"
        docker-compose -f "$compose_file" logs server
        return 1
    fi
    
    # Test API endpoint
    print_info "Testing API endpoint..."
    if curl -sf http://localhost:8080/health | grep -q "ok\|healthy\|status"; then
        print_success "$db: API endpoint working!"
    else
        print_error "$db: API endpoint failed!"
        return 1
    fi
    
    # Show logs
    print_info "Recent logs:"
    docker-compose -f "$compose_file" logs --tail=20 server
    
    print_success "$db: All tests passed!"
}

open_shell() {
    local db=${1:-sqlite}
    local compose_file=$(get_compose_file "$db")
    
    print_info "Opening shell in server container..."
    docker-compose -f "$compose_file" exec server sh
}

open_db_shell() {
    local db=${1:-sqlite}
    local compose_file=$(get_compose_file "$db")
    
    case $db in
        sqlite)
            print_info "Opening SQLite shell..."
            docker-compose -f "$compose_file" exec server sh -c "cd /data && ls -lh kubelens.db"
            print_info "Database file location: /data/kubelens.db"
            print_info "To access: docker-compose -f $compose_file exec server sh"
            ;;
        postgres|postgresql)
            print_info "Opening PostgreSQL shell..."
            docker-compose -f "$compose_file" exec postgres psql -U kubelens -d kubelens
            ;;
        mysql)
            print_info "Opening MySQL shell..."
            docker-compose -f "$compose_file" exec mysql mysql -u kubelens -pkubelens123 kubelens
            ;;
    esac
}

show_status() {
    local db=${1:-all}
    
    print_header
    
    if [ "$db" = "all" ]; then
        for check_db in sqlite postgres mysql; do
            echo -e "${CYAN}=== $check_db ===${NC}"
            local compose_file=$(get_compose_file "$check_db")
            docker-compose -f "$compose_file" ps
            echo ""
        done
    else
        local compose_file=$(get_compose_file "$db")
        docker-compose -f "$compose_file" ps
    fi
}

# Main script
main() {
    local command=${1:-help}
    local db=${2:-sqlite}
    
    case $command in
        up|start)
            print_header
            start_services "$db"
            ;;
        down|stop)
            print_header
            stop_services "$db"
            ;;
        restart)
            print_header
            restart_services "$db"
            ;;
        logs)
            show_logs "$db" "${3:-}"
            ;;
        build)
            print_header
            build_images
            ;;
        clean)
            print_header
            clean_services "$db"
            ;;
        test)
            print_header
            run_tests "$db"
            ;;
        shell)
            open_shell "$db"
            ;;
        db-shell)
            open_db_shell "$db"
            ;;
        status)
            show_status "$db"
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            print_error "Unknown command: $command"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

# Run main function
main "$@"

