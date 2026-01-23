#!/bin/bash
# =============================================================================
# setup-env.sh - Interactive environment setup for Resume Pilot
# =============================================================================
# Usage: ./scripts/setup-env.sh
#
# This script helps you configure the .env file with all required and optional
# environment variables for the Resume Pilot application.
#
# Make executable: chmod +x scripts/setup-env.sh
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
MAGENTA='\033[0;35m'
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

print_section() {
    echo ""
    echo -e "${MAGENTA}--- $1 ---${NC}"
    echo ""
}

show_help() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Interactive setup for Resume Pilot environment variables"
    echo ""
    echo "Options:"
    echo "  --force        Overwrite existing .env file"
    echo "  --minimal      Only prompt for required variables"
    echo "  --help         Show this help message"
    echo ""
    echo "The script will:"
    echo "  1. Check for existing .env file"
    echo "  2. Prompt for required variables"
    echo "  3. Prompt for optional variables"
    echo "  4. Validate format of keys where possible"
    echo "  5. Create .env file from .env.example template"
}

# Prompt for a value with optional default and validation
prompt_value() {
    local var_name=$1
    local description=$2
    local default_value=$3
    local validation_pattern=$4
    local is_secret=$5

    local prompt_text="$description"
    if [ -n "$default_value" ]; then
        prompt_text="$prompt_text [$default_value]"
    fi
    prompt_text="$prompt_text: "

    while true; do
        if [ "$is_secret" = "secret" ]; then
            read -s -p "$prompt_text" value
            echo ""
        else
            read -p "$prompt_text" value
        fi

        # Use default if empty
        if [ -z "$value" ] && [ -n "$default_value" ]; then
            value="$default_value"
        fi

        # Skip validation if empty and no default (will be handled later)
        if [ -z "$value" ]; then
            echo "$value"
            return
        fi

        # Validate if pattern provided
        if [ -n "$validation_pattern" ]; then
            if [[ $value =~ $validation_pattern ]]; then
                echo "$value"
                return
            else
                print_error "Invalid format. Please try again."
            fi
        else
            echo "$value"
            return
        fi
    done
}

# -----------------------------------------------------------------------------
# Parse arguments
# -----------------------------------------------------------------------------
FORCE_OVERWRITE=false
MINIMAL_MODE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --force)
            FORCE_OVERWRITE=true
            shift
            ;;
        --minimal)
            MINIMAL_MODE=true
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

print_header "Resume Pilot - Environment Setup"

# -----------------------------------------------------------------------------
# Check for existing .env file
# -----------------------------------------------------------------------------
if [ -f ".env" ]; then
    if [ "$FORCE_OVERWRITE" = true ]; then
        print_warning "Existing .env file will be overwritten (--force)"
        cp .env ".env.backup.$(date +%Y%m%d_%H%M%S)"
        print_status "Backup created"
    else
        print_warning "An .env file already exists."
        echo ""
        read -p "Do you want to overwrite it? (y/N) " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_status "Setup cancelled. Use --force to overwrite."
            exit 0
        fi
        cp .env ".env.backup.$(date +%Y%m%d_%H%M%S)"
        print_status "Backup created"
    fi
fi

# Check for .env.example template
if [ ! -f ".env.example" ]; then
    print_error ".env.example template not found!"
    exit 1
fi

# -----------------------------------------------------------------------------
# Collect environment variables
# -----------------------------------------------------------------------------

# Initialize variables
declare -A ENV_VARS

print_section "Supabase Configuration (Required)"
echo "Get these from: https://app.supabase.com/project/_/settings/api"
echo ""

ENV_VARS[PUBLIC_SUPABASE_URL]=$(prompt_value \
    "PUBLIC_SUPABASE_URL" \
    "Supabase Project URL (https://xxx.supabase.co)" \
    "" \
    "^https://[a-zA-Z0-9-]+\.supabase\.co$")

ENV_VARS[PUBLIC_SUPABASE_ANON_KEY]=$(prompt_value \
    "PUBLIC_SUPABASE_ANON_KEY" \
    "Supabase Anon Key (eyJ...)" \
    "" \
    "^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$")

ENV_VARS[SUPABASE_SERVICE_ROLE_KEY]=$(prompt_value \
    "SUPABASE_SERVICE_ROLE_KEY" \
    "Supabase Service Role Key" \
    "" \
    "^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$" \
    "secret")

echo ""
echo "Get the database connection string from: Project Settings > Database > Connection string (URI)"
ENV_VARS[SUPABASE_DB_URL]=$(prompt_value \
    "SUPABASE_DB_URL" \
    "Supabase Database URL (postgresql://...)" \
    "" \
    "^postgresql://")

# Validate required Supabase vars
MISSING_REQUIRED=false
for var in PUBLIC_SUPABASE_URL PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY SUPABASE_DB_URL; do
    if [ -z "${ENV_VARS[$var]}" ]; then
        print_error "Required variable $var is missing!"
        MISSING_REQUIRED=true
    fi
done

if [ "$MISSING_REQUIRED" = true ]; then
    print_error "Cannot continue without required Supabase configuration."
    exit 1
fi

print_section "LLM API Keys"
echo "At least one LLM provider is recommended for resume generation."
echo "Get Anthropic key from: https://console.anthropic.com/settings/keys"
echo ""

ENV_VARS[ANTHROPIC_API_KEY]=$(prompt_value \
    "ANTHROPIC_API_KEY" \
    "Anthropic API Key (sk-ant-...)" \
    "" \
    "^sk-ant-" \
    "secret")

if [ "$MINIMAL_MODE" = false ]; then
    echo ""
    echo "Optional: OpenAI and Google keys for additional model options"

    ENV_VARS[OPENAI_API_KEY]=$(prompt_value \
        "OPENAI_API_KEY" \
        "OpenAI API Key (sk-..., press Enter to skip)" \
        "" \
        "^sk-" \
        "secret")

    ENV_VARS[GOOGLE_API_KEY]=$(prompt_value \
        "GOOGLE_API_KEY" \
        "Google AI API Key (press Enter to skip)" \
        "" \
        "" \
        "secret")
fi

print_section "Stripe Configuration"
echo "Get these from: https://dashboard.stripe.com/apikeys"
echo ""

ENV_VARS[STRIPE_SECRET_KEY]=$(prompt_value \
    "STRIPE_SECRET_KEY" \
    "Stripe Secret Key (sk_test_... or sk_live_...)" \
    "" \
    "^sk_(test|live)_" \
    "secret")

ENV_VARS[STRIPE_PUBLISHABLE_KEY]=$(prompt_value \
    "STRIPE_PUBLISHABLE_KEY" \
    "Stripe Publishable Key (pk_test_... or pk_live_...)" \
    "" \
    "^pk_(test|live)_")

echo ""
echo "Webhook secret from: https://dashboard.stripe.com/webhooks"
ENV_VARS[STRIPE_WEBHOOK_SECRET]=$(prompt_value \
    "STRIPE_WEBHOOK_SECRET" \
    "Stripe Webhook Secret (whsec_...)" \
    "" \
    "^whsec_" \
    "secret")

print_section "Inngest Configuration"
echo "Get these from: https://app.inngest.com/env/production/manage/keys"
echo ""

ENV_VARS[INNGEST_EVENT_KEY]=$(prompt_value \
    "INNGEST_EVENT_KEY" \
    "Inngest Event Key" \
    "" \
    "" \
    "secret")

ENV_VARS[INNGEST_SIGNING_KEY]=$(prompt_value \
    "INNGEST_SIGNING_KEY" \
    "Inngest Signing Key" \
    "" \
    "" \
    "secret")

if [ "$MINIMAL_MODE" = false ]; then
    print_section "Job Board APIs (Optional)"
    echo "Get Adzuna keys from: https://developer.adzuna.com/"
    echo ""

    ENV_VARS[ADZUNA_APP_ID]=$(prompt_value \
        "ADZUNA_APP_ID" \
        "Adzuna App ID (press Enter to skip)")

    ENV_VARS[ADZUNA_APP_KEY]=$(prompt_value \
        "ADZUNA_APP_KEY" \
        "Adzuna App Key (press Enter to skip)" \
        "" \
        "" \
        "secret")

    print_section "Observability (Optional)"
    echo "Langfuse provides LLM observability. Get keys from: https://cloud.langfuse.com"
    echo ""

    ENV_VARS[LANGFUSE_PUBLIC_KEY]=$(prompt_value \
        "LANGFUSE_PUBLIC_KEY" \
        "Langfuse Public Key (press Enter to skip)")

    ENV_VARS[LANGFUSE_SECRET_KEY]=$(prompt_value \
        "LANGFUSE_SECRET_KEY" \
        "Langfuse Secret Key (press Enter to skip)" \
        "" \
        "" \
        "secret")

    ENV_VARS[LANGFUSE_HOST]="https://cloud.langfuse.com"

    print_section "Cloudflare AI Gateway (Optional)"
    echo "Provides caching and analytics for LLM calls"
    echo ""

    ENV_VARS[CLOUDFLARE_AI_GATEWAY_URL]=$(prompt_value \
        "CLOUDFLARE_AI_GATEWAY_URL" \
        "Cloudflare AI Gateway URL (press Enter to skip)")
fi

print_section "Application Settings"

ENV_VARS[PUBLIC_APP_URL]=$(prompt_value \
    "PUBLIC_APP_URL" \
    "Application URL" \
    "http://localhost:5173")

# -----------------------------------------------------------------------------
# Generate .env file
# -----------------------------------------------------------------------------
print_header "Generating .env File"

# Start with the template
cp .env.example .env

# Replace values in .env file
for var in "${!ENV_VARS[@]}"; do
    value="${ENV_VARS[$var]}"
    if [ -n "$value" ]; then
        # Escape special characters for sed
        escaped_value=$(printf '%s\n' "$value" | sed -e 's/[\/&]/\\&/g')

        # Try to replace existing line, or append if not found
        if grep -q "^${var}=" .env; then
            sed -i.tmp "s|^${var}=.*|${var}=${escaped_value}|" .env
        else
            echo "${var}=${value}" >> .env
        fi
    fi
done

# Clean up temp files
rm -f .env.tmp

print_success ".env file created successfully!"

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------
print_header "Configuration Summary"

echo "Required variables:"
for var in PUBLIC_SUPABASE_URL PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY SUPABASE_DB_URL; do
    if [ -n "${ENV_VARS[$var]}" ]; then
        echo -e "  ${GREEN}[SET]${NC} $var"
    else
        echo -e "  ${RED}[MISSING]${NC} $var"
    fi
done

echo ""
echo "LLM Providers:"
for var in ANTHROPIC_API_KEY OPENAI_API_KEY GOOGLE_API_KEY; do
    if [ -n "${ENV_VARS[$var]}" ]; then
        echo -e "  ${GREEN}[SET]${NC} $var"
    else
        echo -e "  ${YELLOW}[NOT SET]${NC} $var"
    fi
done

echo ""
echo "Payment & Webhooks:"
for var in STRIPE_SECRET_KEY STRIPE_PUBLISHABLE_KEY STRIPE_WEBHOOK_SECRET; do
    if [ -n "${ENV_VARS[$var]}" ]; then
        echo -e "  ${GREEN}[SET]${NC} $var"
    else
        echo -e "  ${YELLOW}[NOT SET]${NC} $var"
    fi
done

echo ""
echo "Background Jobs:"
for var in INNGEST_EVENT_KEY INNGEST_SIGNING_KEY; do
    if [ -n "${ENV_VARS[$var]}" ]; then
        echo -e "  ${GREEN}[SET]${NC} $var"
    else
        echo -e "  ${YELLOW}[NOT SET]${NC} $var"
    fi
done

print_header "Next Steps"
echo "1. Review the generated .env file"
echo "2. Run database migrations: npm run db:push"
echo "3. Seed initial data: ./scripts/seed-data.sh"
echo "4. Start development server: npm run dev"
echo "5. Or deploy: ./scripts/deploy-cloudflare.sh"
echo ""

print_success "Environment setup complete!"
