# =============================================================================
# HowlerHire - Makefile
# =============================================================================
# A SvelteKit application with Cloudflare, Supabase, Inngest, and Stripe
#
# Usage:
#   make help          - Show all available targets
#   make dev           - Start development server
#   make dev-all       - Start all services (app + inngest + docker)
#   make build         - Build for production
#   make deploy-prod   - Deploy to Cloudflare production
# =============================================================================

# Default shell
SHELL := /bin/bash

# Project settings
PROJECT_NAME := howlerhire
NODE_VERSION := 20

# Colors for output
CYAN := \033[36m
GREEN := \033[32m
YELLOW := \033[33m
RED := \033[31m
RESET := \033[0m

# =============================================================================
# PHONY Targets
# =============================================================================
.PHONY: help dev dev-inngest dev-docker dev-all dev-services \
        build preview check check-watch lint format test \
        db-push db-generate db-migrate db-studio db-seed \
        deploy-preview deploy-prod deploy-docker \
        setup install clean env-check docker-up docker-down docker-logs \
        stripe-listen prompts-seed

# =============================================================================
# Help
# =============================================================================
.DEFAULT_GOAL := help

help: ## Show this help message
	@echo ""
	@echo "$(CYAN)$(PROJECT_NAME) - Available Commands$(RESET)"
	@echo ""
	@echo "$(GREEN)Development:$(RESET)"
	@grep -E '^(dev|dev-inngest|dev-docker|dev-all|dev-services):.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(CYAN)%-18s$(RESET) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(GREEN)Build & Test:$(RESET)"
	@grep -E '^(build|preview|check|check-watch|lint|format|test):.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(CYAN)%-18s$(RESET) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(GREEN)Database:$(RESET)"
	@grep -E '^(db-):.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(CYAN)%-18s$(RESET) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(GREEN)Deployment:$(RESET)"
	@grep -E '^(deploy-):.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(CYAN)%-18s$(RESET) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(GREEN)Setup & Utilities:$(RESET)"
	@grep -E '^(setup|install|clean|env-check|docker-up|docker-down|docker-logs|stripe-listen|prompts-seed):.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(CYAN)%-18s$(RESET) %s\n", $$1, $$2}'
	@echo ""

# =============================================================================
# Development
# =============================================================================
dev: ## Start SvelteKit development server
	@echo "$(CYAN)Starting development server...$(RESET)"
	npm run dev

dev-inngest: ## Start Inngest development server
	@echo "$(CYAN)Starting Inngest dev server...$(RESET)"
	npm run inngest:dev

dev-docker: ## Start Docker services (LiteLLM, Postgres, Inngest)
	@echo "$(CYAN)Starting Docker services...$(RESET)"
	docker-compose up -d
	@echo "$(GREEN)Services started:$(RESET)"
	@echo "  - LiteLLM Proxy: http://localhost:4000"
	@echo "  - PostgreSQL: localhost:5433"
	@echo "  - Inngest: http://localhost:8288"
	@echo "  - Claude-Flow MCP: http://localhost:3001"

dev-all: env-check ## Start all services concurrently (app + inngest + docker)
	@echo "$(CYAN)Starting all development services...$(RESET)"
	@make dev-docker
	@echo "$(CYAN)Waiting for services to be ready...$(RESET)"
	@sleep 3
	@npx concurrently -n "app,inngest" -c "cyan,magenta" \
		"npm run dev" \
		"npm run inngest:dev"

dev-services: dev-docker ## Alias for dev-docker
	@echo "$(GREEN)Docker services are running$(RESET)"

# =============================================================================
# Build & Test
# =============================================================================
build: ## Build for production (Cloudflare)
	@echo "$(CYAN)Building for production...$(RESET)"
	npm run build
	@echo "$(GREEN)Build complete! Output in .svelte-kit/cloudflare$(RESET)"

preview: build ## Preview production build locally
	@echo "$(CYAN)Starting preview server...$(RESET)"
	npm run preview

check: ## Run TypeScript type checking
	@echo "$(CYAN)Running type check...$(RESET)"
	npm run check

check-watch: ## Run TypeScript type checking in watch mode
	@echo "$(CYAN)Running type check in watch mode...$(RESET)"
	npm run check:watch

lint: ## Run ESLint and Prettier checks
	@echo "$(CYAN)Running linter...$(RESET)"
	npm run lint

format: ## Format code with Prettier
	@echo "$(CYAN)Formatting code...$(RESET)"
	npm run format
	@echo "$(GREEN)Code formatted!$(RESET)"

test: ## Run tests with Vitest
	@echo "$(CYAN)Running tests...$(RESET)"
	npm run test

test-watch: ## Run tests in watch mode
	@echo "$(CYAN)Running tests in watch mode...$(RESET)"
	npm run test -- --watch

test-coverage: ## Run tests with coverage report
	@echo "$(CYAN)Running tests with coverage...$(RESET)"
	npm run test -- --coverage

# =============================================================================
# Database (Drizzle + Supabase)
# =============================================================================
db-push: env-check ## Push schema changes directly to database
	@echo "$(CYAN)Pushing schema to database...$(RESET)"
	npm run db:push
	@echo "$(GREEN)Schema pushed successfully!$(RESET)"

db-generate: ## Generate migration files from schema changes
	@echo "$(CYAN)Generating migration files...$(RESET)"
	npm run db:generate
	@echo "$(GREEN)Migration files generated in supabase/migrations/$(RESET)"

db-migrate: env-check ## Run pending migrations
	@echo "$(CYAN)Running migrations...$(RESET)"
	npm run db:migrate
	@echo "$(GREEN)Migrations complete!$(RESET)"

db-studio: ## Open Drizzle Studio for database management
	@echo "$(CYAN)Opening Drizzle Studio...$(RESET)"
	npm run db:studio

db-seed: env-check ## Seed the prompts database
	@echo "$(CYAN)Seeding prompts...$(RESET)"
	npm run prompts:seed
	@echo "$(GREEN)Prompts seeded!$(RESET)"

# =============================================================================
# Deployment
# =============================================================================
deploy-preview: build ## Deploy to Cloudflare preview environment
	@echo "$(CYAN)Deploying to Cloudflare preview...$(RESET)"
	npx wrangler deploy --env development
	@echo "$(GREEN)Preview deployment complete!$(RESET)"

deploy-prod: build ## Deploy to Cloudflare production
	@echo "$(YELLOW)Deploying to PRODUCTION...$(RESET)"
	@read -p "Are you sure you want to deploy to production? [y/N] " confirm && \
		[ "$$confirm" = "y" ] || [ "$$confirm" = "Y" ] || (echo "Aborted." && exit 1)
	npx wrangler deploy --env production
	@echo "$(GREEN)Production deployment complete!$(RESET)"

deploy-docker: ## Build and push Docker image
	@echo "$(CYAN)Building Docker image...$(RESET)"
	docker build -t $(PROJECT_NAME):latest .
	@echo "$(GREEN)Docker image built: $(PROJECT_NAME):latest$(RESET)"
	@echo "$(YELLOW)To push to a registry, tag and push manually:$(RESET)"
	@echo "  docker tag $(PROJECT_NAME):latest your-registry/$(PROJECT_NAME):latest"
	@echo "  docker push your-registry/$(PROJECT_NAME):latest"

# =============================================================================
# Setup & Utilities
# =============================================================================
setup: ## Full project setup (install deps, check env, setup git hooks)
	@echo "$(CYAN)Setting up $(PROJECT_NAME)...$(RESET)"
	@make install
	@make env-check || echo "$(YELLOW)Warning: Some environment variables missing$(RESET)"
	@echo ""
	@echo "$(GREEN)Setup complete!$(RESET)"
	@echo ""
	@echo "Next steps:"
	@echo "  1. Copy .env.example to .env and fill in your values"
	@echo "  2. Run 'make dev-docker' to start background services"
	@echo "  3. Run 'make dev' to start the development server"
	@echo ""

install: ## Install npm dependencies
	@echo "$(CYAN)Installing dependencies...$(RESET)"
	npm install
	@echo "$(GREEN)Dependencies installed!$(RESET)"

clean: ## Clean build artifacts and caches
	@echo "$(CYAN)Cleaning build artifacts...$(RESET)"
	rm -rf .svelte-kit
	rm -rf node_modules/.vite
	rm -rf build
	rm -rf .vercel
	rm -rf .wrangler
	@echo "$(GREEN)Clean complete!$(RESET)"

clean-all: clean ## Clean everything including node_modules
	@echo "$(CYAN)Removing node_modules...$(RESET)"
	rm -rf node_modules
	@echo "$(GREEN)Full clean complete!$(RESET)"

env-check: ## Verify required environment variables are set
	@echo "$(CYAN)Checking environment variables...$(RESET)"
	@missing=0; \
	if [ ! -f .env ]; then \
		echo "$(RED)Error: .env file not found$(RESET)"; \
		echo "  Copy .env.example to .env and fill in your values"; \
		exit 1; \
	fi; \
	for var in PUBLIC_SUPABASE_URL PUBLIC_SUPABASE_ANON_KEY SUPABASE_DB_URL; do \
		if ! grep -q "^$$var=.\+" .env 2>/dev/null; then \
			echo "$(RED)Missing or empty: $$var$(RESET)"; \
			missing=1; \
		fi; \
	done; \
	if [ $$missing -eq 1 ]; then \
		echo "$(YELLOW)Some required variables are missing. Check .env.example for reference.$(RESET)"; \
		exit 1; \
	fi; \
	echo "$(GREEN)All required environment variables are set!$(RESET)"

# =============================================================================
# Docker Utilities
# =============================================================================
docker-up: ## Start all Docker services
	@echo "$(CYAN)Starting Docker services...$(RESET)"
	docker-compose up -d
	@echo "$(GREEN)Services started!$(RESET)"

docker-down: ## Stop all Docker services
	@echo "$(CYAN)Stopping Docker services...$(RESET)"
	docker-compose down
	@echo "$(GREEN)Services stopped!$(RESET)"

docker-logs: ## View Docker service logs
	docker-compose logs -f

docker-clean: ## Stop services and remove volumes
	@echo "$(YELLOW)Stopping services and removing volumes...$(RESET)"
	docker-compose down -v
	@echo "$(GREEN)Docker cleanup complete!$(RESET)"

# =============================================================================
# Additional Utilities
# =============================================================================
stripe-listen: ## Start Stripe webhook listener for local development
	@echo "$(CYAN)Starting Stripe webhook listener...$(RESET)"
	@echo "$(YELLOW)Make sure you have the Stripe CLI installed$(RESET)"
	stripe listen --forward-to localhost:5173/api/stripe/webhook

prompts-seed: db-seed ## Alias for db-seed (seed prompts)

# =============================================================================
# CI/CD Helpers
# =============================================================================
ci-check: ## Run all CI checks (lint, type-check, test)
	@echo "$(CYAN)Running CI checks...$(RESET)"
	@make lint
	@make check
	@make test -- --run
	@echo "$(GREEN)All CI checks passed!$(RESET)"

ci-build: ci-check build ## Run CI checks and build
	@echo "$(GREEN)CI build complete!$(RESET)"
