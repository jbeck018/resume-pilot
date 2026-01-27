#!/bin/bash
# =============================================================================
# seed-data.sh - Seed initial data for HowlerHire
# =============================================================================
# Usage: ./scripts/seed-data.sh
#
# Seeds the database with:
#   - Subscription tiers (free, pro, premium)
#   - Any other initial data needed for the application
#
# Safe to run multiple times (uses upsert logic)
#
# Make executable: chmod +x scripts/seed-data.sh
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
    echo "Seed initial data for HowlerHire"
    echo ""
    echo "Options:"
    echo "  --dry-run      Show SQL without executing"
    echo "  --force        Skip confirmation prompts"
    echo "  --help         Show this help message"
    echo ""
    echo "This script will seed:"
    echo "  - Subscription tiers (free, pro, premium)"
    echo ""
    echo "Safe to run multiple times (uses upsert logic)"
}

# -----------------------------------------------------------------------------
# Parse arguments
# -----------------------------------------------------------------------------
DRY_RUN=false
FORCE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --force)
            FORCE=true
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
# Change to project root and load env
# -----------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

print_header "HowlerHire - Database Seeding"

# Load .env file
if [ ! -f ".env" ]; then
    print_error ".env file not found. Run ./scripts/setup-env.sh first."
    exit 1
fi

set -a
source .env
set +a

# Validate database URL
if [ -z "$SUPABASE_DB_URL" ]; then
    print_error "SUPABASE_DB_URL is not set in .env"
    exit 1
fi

# Check for psql
if ! command -v psql &> /dev/null; then
    print_error "psql is not installed. Please install PostgreSQL client."
    echo "  macOS: brew install postgresql"
    echo "  Ubuntu: sudo apt-get install postgresql-client"
    exit 1
fi

print_success "PostgreSQL client found"

# -----------------------------------------------------------------------------
# Subscription Tiers SQL
# -----------------------------------------------------------------------------

SUBSCRIPTION_TIERS_SQL=$(cat << 'EOF'
-- =============================================================================
-- Subscription Tiers Seed Data
-- =============================================================================
-- Uses INSERT ... ON CONFLICT for upsert behavior (safe to run multiple times)

INSERT INTO subscription_tiers (
    name,
    display_name,
    description,
    price_monthly,
    price_yearly,
    generation_limit_weekly,
    job_discovery_limit_daily,
    features,
    badge_text,
    sort_order,
    is_active
) VALUES
-- Free Tier
(
    'free',
    'Free',
    'Get started with basic resume generation',
    0,
    0,
    3,  -- 3 generations per week
    10, -- 10 job discoveries per day
    '{
        "resume_styles": ["classic"],
        "cover_letter": false,
        "job_matching": true,
        "ats_optimization": false,
        "linkedin_optimization": false,
        "interview_prep": false,
        "salary_negotiation": false,
        "career_coaching": false,
        "api_access": false,
        "priority_support": false
    }'::jsonb,
    NULL,
    0,
    true
),
-- Pro Tier
(
    'pro',
    'Pro',
    'Perfect for active job seekers',
    1499, -- $14.99/month in cents
    14990, -- $149.90/year in cents (2 months free)
    25,  -- 25 generations per week
    -1,  -- Unlimited job discoveries
    '{
        "resume_styles": ["classic", "modern", "creative", "executive"],
        "cover_letter": true,
        "job_matching": true,
        "ats_optimization": true,
        "linkedin_optimization": true,
        "interview_prep": false,
        "salary_negotiation": false,
        "career_coaching": false,
        "api_access": false,
        "priority_support": false
    }'::jsonb,
    'Popular',
    1,
    true
),
-- Premium Tier
(
    'premium',
    'Premium',
    'Full career toolkit with unlimited features',
    2999, -- $29.99/month in cents
    29990, -- $299.90/year in cents (2 months free)
    -1,  -- Unlimited generations
    -1,  -- Unlimited job discoveries
    '{
        "resume_styles": ["classic", "modern", "creative", "executive", "academic", "tech"],
        "cover_letter": true,
        "job_matching": true,
        "ats_optimization": true,
        "linkedin_optimization": true,
        "interview_prep": true,
        "salary_negotiation": true,
        "career_coaching": true,
        "api_access": true,
        "priority_support": true,
        "white_label": false,
        "custom_branding": false,
        "advanced_analytics": true
    }'::jsonb,
    'Best Value',
    2,
    true
)
ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    price_monthly = EXCLUDED.price_monthly,
    price_yearly = EXCLUDED.price_yearly,
    generation_limit_weekly = EXCLUDED.generation_limit_weekly,
    job_discovery_limit_daily = EXCLUDED.job_discovery_limit_daily,
    features = EXCLUDED.features,
    badge_text = EXCLUDED.badge_text,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();
EOF
)

# -----------------------------------------------------------------------------
# Execute seeding
# -----------------------------------------------------------------------------

if [ "$DRY_RUN" = true ]; then
    print_header "Dry Run - SQL to be executed"
    echo "$SUBSCRIPTION_TIERS_SQL"
    echo ""
    print_status "No changes made (--dry-run mode)"
    exit 0
fi

# Confirmation prompt
if [ "$FORCE" = false ]; then
    print_warning "This will seed/update data in your database."
    echo ""
    read -p "Do you want to continue? (y/N) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_status "Seeding cancelled."
        exit 0
    fi
fi

# Test database connection first
print_status "Testing database connection..."
if ! psql "$SUPABASE_DB_URL" -c "SELECT 1" > /dev/null 2>&1; then
    print_error "Failed to connect to database. Check SUPABASE_DB_URL in .env"
    exit 1
fi
print_success "Database connection successful"

# Seed subscription tiers
print_header "Seeding Subscription Tiers"

if psql "$SUPABASE_DB_URL" -c "$SUBSCRIPTION_TIERS_SQL" 2>&1; then
    print_success "Subscription tiers seeded successfully"
else
    print_error "Failed to seed subscription tiers"
    exit 1
fi

# Verify seeded data
print_header "Verifying Seeded Data"

VERIFY_SQL="SELECT name, display_name, price_monthly/100.0 as price_monthly_dollars, generation_limit_weekly FROM subscription_tiers ORDER BY sort_order;"

print_status "Current subscription tiers:"
echo ""
psql "$SUPABASE_DB_URL" -c "$VERIFY_SQL"

# Count tiers
TIER_COUNT=$(psql "$SUPABASE_DB_URL" -t -c "SELECT COUNT(*) FROM subscription_tiers WHERE is_active = true;" | tr -d ' ')
print_success "Found $TIER_COUNT active subscription tiers"

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------

print_header "Seeding Complete"

echo "Seeded data:"
echo "  - 3 subscription tiers (free, pro, premium)"
echo ""
echo "Next steps:"
echo "  1. Configure Stripe products/prices in Stripe Dashboard"
echo "  2. Update tier records with Stripe IDs:"
echo "     UPDATE subscription_tiers SET stripe_product_id = '...' WHERE name = 'pro';"
echo "  3. Start the application: npm run dev"
echo ""

print_success "Database seeding finished successfully!"
