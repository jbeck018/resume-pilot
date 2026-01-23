#!/bin/bash
# =============================================================================
# deploy-cloudflare.sh - Deploy Resume Pilot to Cloudflare Pages
# =============================================================================
# Usage: ./scripts/deploy-cloudflare.sh [--preview|--production]
#
# Prerequisites:
#   - Wrangler CLI installed (npm install -g wrangler)
#   - Authenticated with Cloudflare (wrangler login)
#   - Environment variables configured
#
# Make executable: chmod +x scripts/deploy-cloudflare.sh
# =============================================================================

set -e
set -o pipefail

# -----------------------------------------------------------------------------
# Color codes for output
# -----------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# -----------------------------------------------------------------------------
# Helper functions
# -----------------------------------------------------------------------------
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo ""
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""
}

show_help() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Deploy Resume Pilot to Cloudflare Pages"
    echo ""
    echo "Options:"
    echo "  --preview      Deploy to preview environment (default)"
    echo "  --production   Deploy to production environment"
    echo "  --skip-build   Skip the build step (use existing build)"
    echo "  --help         Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                    # Deploy to preview"
    echo "  $0 --production       # Deploy to production"
    echo "  $0 --skip-build       # Deploy existing build to preview"
    echo ""
    echo "Prerequisites:"
    echo "  - Wrangler CLI: npm install -g wrangler"
    echo "  - Cloudflare authentication: wrangler login"
    echo "  - Environment variables configured in .env"
}

# -----------------------------------------------------------------------------
# Parse arguments
# -----------------------------------------------------------------------------
ENVIRONMENT="preview"
SKIP_BUILD=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --preview)
            ENVIRONMENT="preview"
            shift
            ;;
        --production)
            ENVIRONMENT="production"
            shift
            ;;
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --help|-h)
            show_help
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# -----------------------------------------------------------------------------
# Change to project root
# -----------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

print_header "Resume Pilot - Cloudflare Pages Deployment"
print_status "Environment: $ENVIRONMENT"
print_status "Project root: $PROJECT_ROOT"

# -----------------------------------------------------------------------------
# Check prerequisites
# -----------------------------------------------------------------------------
print_header "Checking Prerequisites"

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    print_error "Wrangler CLI is not installed."
    echo "Install with: npm install -g wrangler"
    echo "Then authenticate: wrangler login"
    exit 1
fi
print_success "Wrangler CLI found"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    print_warning "node_modules not found. Running npm install..."
    npm install
fi
print_success "Dependencies installed"

# Check for .env file
if [ ! -f ".env" ]; then
    print_error ".env file not found. Run ./scripts/setup-env.sh first."
    exit 1
fi
print_success ".env file exists"

# -----------------------------------------------------------------------------
# Validate required environment variables
# -----------------------------------------------------------------------------
print_header "Validating Environment Variables"

# Load .env file
set -a
source .env
set +a

REQUIRED_VARS=(
    "PUBLIC_SUPABASE_URL"
    "PUBLIC_SUPABASE_ANON_KEY"
    "SUPABASE_SERVICE_ROLE_KEY"
    "SUPABASE_DB_URL"
)

MISSING_VARS=()

for VAR in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!VAR}" ]; then
        MISSING_VARS+=("$VAR")
    fi
done

if [ ${#MISSING_VARS[@]} -ne 0 ]; then
    print_error "Missing required environment variables:"
    for VAR in "${MISSING_VARS[@]}"; do
        echo "  - $VAR"
    done
    exit 1
fi

print_success "All required environment variables are set"

# Warn about optional but recommended variables
RECOMMENDED_VARS=(
    "ANTHROPIC_API_KEY"
    "INNGEST_EVENT_KEY"
    "INNGEST_SIGNING_KEY"
)

for VAR in "${RECOMMENDED_VARS[@]}"; do
    if [ -z "${!VAR}" ]; then
        print_warning "Optional variable not set: $VAR"
    fi
done

# -----------------------------------------------------------------------------
# Run type checking
# -----------------------------------------------------------------------------
print_header "Running Type Check"
npm run check
print_success "Type check passed"

# -----------------------------------------------------------------------------
# Build the application
# -----------------------------------------------------------------------------
if [ "$SKIP_BUILD" = true ]; then
    print_header "Skipping Build (--skip-build)"
    if [ ! -d ".svelte-kit/cloudflare" ]; then
        print_error "No build found. Run without --skip-build first."
        exit 1
    fi
    print_success "Using existing build"
else
    print_header "Building Application"
    npm run build
    print_success "Build completed"
fi

# -----------------------------------------------------------------------------
# Deploy to Cloudflare Pages
# -----------------------------------------------------------------------------
print_header "Deploying to Cloudflare Pages ($ENVIRONMENT)"

if [ "$ENVIRONMENT" = "production" ]; then
    print_warning "Deploying to PRODUCTION environment!"
    echo ""
    read -p "Are you sure you want to deploy to production? (y/N) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_status "Deployment cancelled."
        exit 0
    fi

    # Production deployment
    DEPLOY_OUTPUT=$(wrangler pages deploy .svelte-kit/cloudflare --project-name resume-pilot --branch main 2>&1)
else
    # Preview deployment
    DEPLOY_OUTPUT=$(wrangler pages deploy .svelte-kit/cloudflare --project-name resume-pilot 2>&1)
fi

echo "$DEPLOY_OUTPUT"

# -----------------------------------------------------------------------------
# Extract and display deployment URL
# -----------------------------------------------------------------------------
print_header "Deployment Complete"

# Try to extract the deployment URL from output
DEPLOYMENT_URL=$(echo "$DEPLOY_OUTPUT" | grep -oE 'https://[a-zA-Z0-9.-]+\.pages\.dev' | head -1)

if [ -n "$DEPLOYMENT_URL" ]; then
    print_success "Deployment URL: $DEPLOYMENT_URL"
    echo ""
    echo -e "${GREEN}Your application is now live at:${NC}"
    echo -e "${CYAN}  $DEPLOYMENT_URL${NC}"
    echo ""
else
    print_warning "Could not extract deployment URL from output."
    echo "Check the Cloudflare Pages dashboard for the deployment URL."
fi

# Production-specific message
if [ "$ENVIRONMENT" = "production" ]; then
    echo -e "${GREEN}Production deployment complete!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Verify the deployment at the URL above"
    echo "  2. Run health checks: ./scripts/health-check.sh $DEPLOYMENT_URL"
    echo "  3. Monitor the Cloudflare Pages dashboard"
fi

print_success "Deployment finished successfully!"
