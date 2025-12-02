.PHONY: help up down logs restart rebuild clean db-shell backend-shell

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-15s %s\n", $$1, $$2}'

up: ## Start all services
	docker-compose up -d
	@echo "✅ Services started!"
	@echo "Backend: http://localhost:3000"
	@echo "Database: localhost:5432"

down: ## Stop all services
	docker-compose down
	@echo "✅ Services stopped!"

logs: ## View logs from all services
	docker-compose logs -f

logs-backend: ## View backend logs
	docker-compose logs -f backend

logs-db: ## View database logs
	docker-compose logs -f postgres

restart: ## Restart all services
	docker-compose restart
	@echo "✅ Services restarted!"

restart-backend: ## Restart backend only
	docker-compose restart backend
	@echo "✅ Backend restarted!"

rebuild: ## Rebuild and start services
	docker-compose up -d --build
	@echo "✅ Services rebuilt and started!"

clean: ## Stop and remove all containers, volumes, and networks
	docker-compose down -v
	@echo "✅ Everything cleaned up!"

db-shell: ## Access PostgreSQL shell
	docker-compose exec postgres psql -U postgres -d movieapp

backend-shell: ## Access backend container shell
	docker-compose exec backend sh

migrate: ## Run database migrations
	docker-compose exec backend npm run migration:run

test: ## Run backend tests
	docker-compose exec backend npm test

install: ## Install dependencies (first time setup)
	@echo "Setting up backend..."
	cd backend && npm install
	@echo "Setting up mobile..."
	cd mobile && npm install
	@echo "✅ Dependencies installed!"

status: ## Show status of all services
	docker-compose ps

