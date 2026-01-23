#!/bin/bash

# =============================================================================
# Resume Pilot - Deploy Secrets to Cloudflare Pages
# =============================================================================
# Usage:
#   ./scripts/deploy-secrets.sh [env-file] [project-name]
#
# Examples:
#   ./scripts/deploy-secrets.sh                           # Uses defaults
#   ./scripts/deploy-secrets.sh .env.production           # Custom env file
#   ./scripts/deploy-secrets.sh .env.production my-app    # Custom project name
# =============================================================================

set -e

# Configuration
ENV_FILE="${1:-.env.production}"
PROJECT_NAME="${2:-resume-pilot}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Resume Pilot - Cloudflare Secrets Deployment          ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if env file exists
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}Error: Environment file '$ENV_FILE' not found${NC}"
    echo ""
    echo "Please create the file with your production values:"
    echo "  cp .env.production.example .env.production"
    echo "  # Edit .env.production with your values"
    echo "  ./scripts/deploy-secrets.sh"
    exit 1
fi

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo -e "${YELLOW}Wrangler CLI not found. Installing...${NC}"
    npm install -g wrangler
fi

# Check if logged in to Cloudflare
echo -e "${BLUE}Checking Cloudflare authentication...${NC}"
if ! wrangler whoami &> /dev/null; then
    echo -e "${YELLOW}Not logged in to Cloudflare. Please authenticate:${NC}"
    wrangler login
fi

echo ""
echo -e "${GREEN}✓ Authenticated with Cloudflare${NC}"
echo -e "${BLUE}Project: ${NC}$PROJECT_NAME"
echo -e "${BLUE}Env file: ${NC}$ENV_FILE"
echo ""

# Define which variables are secrets (server-side only)
SECRETS=(
    "SUPABASE_SERVICE_ROLE_KEY"
    "SUPABASE_DB_URL"
    "ANTHROPIC_API_KEY"
    "OPENAI_API_KEY"
    "GOOGLE_API_KEY"
    "INNGEST_EVENT_KEY"
    "INNGEST_SIGNING_KEY"
    "STRIPE_SECRET_KEY"
    "STRIPE_WEBHOOK_SECRET"
    "RESEND_API_KEY"
    "ADZUNA_APP_ID"
    "ADZUNA_APP_KEY"
    "LANGFUSE_PUBLIC_KEY"
    "LANGFUSE_SECRET_KEY"
    "PERPLEXITY_API_KEY"
    "TAVILY_API_KEY"
)

# Define public variables (can be in plaintext)
PUBLIC_VARS=(
    "PUBLIC_SUPABASE_URL"
    "PUBLIC_SUPABASE_ANON_KEY"
    "PUBLIC_APP_URL"
    "STRIPE_PUBLISHABLE_KEY"
    "LANGFUSE_HOST"
    "CLOUDFLARE_AI_GATEWAY_URL"
)

# Function to get value from env file
get_env_value() {
    local key=$1
    local value=$(grep "^${key}=" "$ENV_FILE" | cut -d '=' -f2- | sed 's/^"//' | sed 's/"$//')
    echo "$value"
}

# Function to check if value is a placeholder
is_placeholder() {
    local value=$1
    if [[ "$value" == *"your-"* ]] || [[ "$value" == *"..."* ]] || [[ "$value" == *"xxxx"* ]] || [[ -z "$value" ]]; then
        return 0  # true, is placeholder
    fi
    return 1  # false, is real value
}

# Track counts
SECRETS_SET=0
SECRETS_SKIPPED=0
PUBLIC_SET=0
PUBLIC_SKIPPED=0

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Setting Secrets (Server-side only)${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"

for secret in "${SECRETS[@]}"; do
    value=$(get_env_value "$secret")

    if is_placeholder "$value"; then
        echo -e "${YELLOW}⊘ SKIP${NC} $secret (placeholder or empty)"
        ((SECRETS_SKIPPED++))
    else
        echo -e "${GREEN}● SET${NC}  $secret"
        echo "$value" | wrangler pages secret put "$secret" --project-name "$PROJECT_NAME" 2>/dev/null
        ((SECRETS_SET++))
    fi
done

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Setting Public Variables${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"

# Build the environment variables JSON for public vars
PUBLIC_VARS_JSON="{"
FIRST=true

for var in "${PUBLIC_VARS[@]}"; do
    value=$(get_env_value "$var")

    if is_placeholder "$value"; then
        echo -e "${YELLOW}⊘ SKIP${NC} $var (placeholder or empty)"
        ((PUBLIC_SKIPPED++))
    else
        echo -e "${GREEN}● SET${NC}  $var"
        if [ "$FIRST" = true ]; then
            FIRST=false
        else
            PUBLIC_VARS_JSON+=","
        fi
        PUBLIC_VARS_JSON+="\"$var\":\"$value\""
        ((PUBLIC_SET++))
    fi
done

PUBLIC_VARS_JSON+="}"

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Summary${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  Secrets set:     ${GREEN}$SECRETS_SET${NC}"
echo -e "  Secrets skipped: ${YELLOW}$SECRETS_SKIPPED${NC}"
echo -e "  Public vars set: ${GREEN}$PUBLIC_SET${NC}"
echo -e "  Public skipped:  ${YELLOW}$PUBLIC_SKIPPED${NC}"
echo ""

if [ $SECRETS_SKIPPED -gt 0 ] || [ $PUBLIC_SKIPPED -gt 0 ]; then
    echo -e "${YELLOW}⚠ Some variables were skipped because they contain placeholders.${NC}"
    echo -e "${YELLOW}  Edit $ENV_FILE and re-run this script to set them.${NC}"
    echo ""
fi

# Show next steps
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Next Steps${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo "1. Deploy your application:"
echo -e "   ${GREEN}npm run build && wrangler pages deploy .svelte-kit/cloudflare --project-name $PROJECT_NAME${NC}"
echo ""
echo "2. Run database migrations:"
echo -e "   ${GREEN}npx supabase db push${NC}"
echo ""
echo "3. Configure Inngest webhook:"
echo "   - Go to https://app.inngest.com"
echo "   - Set webhook URL: https://$PROJECT_NAME.pages.dev/api/inngest"
echo ""
echo "4. Configure Stripe webhook:"
echo "   - Go to https://dashboard.stripe.com/webhooks"
echo "   - Add endpoint: https://$PROJECT_NAME.pages.dev/api/stripe/webhook"
echo "   - Select events: checkout.session.completed, customer.subscription.*"
echo ""
echo "5. Verify deployment:"
echo -e "   ${GREEN}curl https://$PROJECT_NAME.pages.dev/health${NC}"
echo ""
echo -e "${GREEN}Done!${NC}"
