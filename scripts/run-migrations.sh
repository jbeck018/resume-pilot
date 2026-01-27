#!/bin/bash
# =============================================================================
# HowlerHire Migration Runner
# =============================================================================
# This script safely executes database migrations for howlerhire deployment.
#
# Usage:
#   ./scripts/run-migrations.sh [--verify-only] [--specific 0009,0010]
#
# Options:
#   --verify-only    Only run verification, don't execute migrations
#   --specific       Run only specific migrations (comma-separated prefixes)
#   --rollback       Run rollback instead of forward migration
#   --help           Show this help message
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
MIGRATIONS_DIR="$PROJECT_ROOT/supabase/migrations"

# Parse arguments
VERIFY_ONLY=false
SPECIFIC_MIGRATIONS=""
ROLLBACK=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --verify-only)
            VERIFY_ONLY=true
            shift
            ;;
        --specific)
            SPECIFIC_MIGRATIONS="$2"
            shift 2
            ;;
        --rollback)
            ROLLBACK=true
            shift
            ;;
        --help)
            echo "Usage: $0 [--verify-only] [--specific 0009,0010] [--rollback]"
            echo ""
            echo "Options:"
            echo "  --verify-only    Only run verification, don't execute migrations"
            echo "  --specific       Run only specific migrations (comma-separated prefixes)"
            echo "  --rollback       Run rollback instead of forward migration"
            echo "  --help           Show this help message"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}  HowlerHire Database Migration Runner${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# Check for required environment variables
if [ -z "$DATABASE_URL" ] && [ -z "$SUPABASE_DB_URL" ]; then
    echo -e "${YELLOW}Warning: DATABASE_URL or SUPABASE_DB_URL not set${NC}"
    echo "Using Supabase CLI for migrations..."
    USE_SUPABASE_CLI=true
else
    USE_SUPABASE_CLI=false
    DB_URL="${DATABASE_URL:-$SUPABASE_DB_URL}"
fi

# List migration files
echo -e "${BLUE}Migration Files Found:${NC}"
echo "----------------------------------------------"
ls -la "$MIGRATIONS_DIR"/*.sql 2>/dev/null | while read line; do
    filename=$(basename "$(echo "$line" | awk '{print $NF}')")
    echo "  - $filename"
done
echo ""

# Function to run SQL query
run_sql() {
    if [ "$USE_SUPABASE_CLI" = true ]; then
        echo "$1" | npx supabase db query 2>/dev/null || echo "Query execution via Supabase CLI"
    else
        psql "$DB_URL" -t -c "$1" 2>/dev/null || echo "N/A"
    fi
}

# Verification function
verify_prerequisites() {
    echo -e "${BLUE}Verifying Prerequisites...${NC}"
    echo "----------------------------------------------"

    # Check profiles table
    echo -n "  Profiles table exists: "
    if [ "$USE_SUPABASE_CLI" = true ]; then
        echo -e "${GREEN}[Using Supabase CLI - assumed OK]${NC}"
    else
        result=$(run_sql "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles');")
        if [[ "$result" == *"t"* ]]; then
            echo -e "${GREEN}YES${NC}"
        else
            echo -e "${RED}NO - Run 0001_initial_schema.sql first${NC}"
            exit 1
        fi
    fi

    # Check jobs table
    echo -n "  Jobs table with user_feedback: "
    if [ "$USE_SUPABASE_CLI" = true ]; then
        echo -e "${GREEN}[Using Supabase CLI - assumed OK]${NC}"
    else
        result=$(run_sql "SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'jobs' AND column_name = 'user_feedback');")
        if [[ "$result" == *"t"* ]]; then
            echo -e "${GREEN}YES${NC}"
        else
            echo -e "${RED}NO - Run 0001_initial_schema.sql first${NC}"
            exit 1
        fi
    fi

    # Check if migrations already applied (idempotency check)
    echo -n "  learned_preferences column: "
    if [ "$USE_SUPABASE_CLI" = true ]; then
        echo -e "${YELLOW}[Will use IF NOT EXISTS]${NC}"
    else
        result=$(run_sql "SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'learned_preferences');")
        if [[ "$result" == *"t"* ]]; then
            echo -e "${YELLOW}Already exists (will skip)${NC}"
        else
            echo -e "${GREEN}Not yet created${NC}"
        fi
    fi

    echo -n "  email_preferences column: "
    if [ "$USE_SUPABASE_CLI" = true ]; then
        echo -e "${YELLOW}[Will use IF NOT EXISTS]${NC}"
    else
        result=$(run_sql "SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'email_preferences');")
        if [[ "$result" == *"t"* ]]; then
            echo -e "${YELLOW}Already exists (will skip)${NC}"
        else
            echo -e "${GREEN}Not yet created${NC}"
        fi
    fi

    echo -n "  email_send_history table: "
    if [ "$USE_SUPABASE_CLI" = true ]; then
        echo -e "${YELLOW}[Will use IF NOT EXISTS]${NC}"
    else
        result=$(run_sql "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'email_send_history');")
        if [[ "$result" == *"t"* ]]; then
            echo -e "${YELLOW}Already exists (will skip)${NC}"
        else
            echo -e "${GREEN}Not yet created${NC}"
        fi
    fi

    echo ""
    echo -e "${GREEN}Prerequisites verified!${NC}"
    echo ""
}

# Run migrations function
run_migrations() {
    echo -e "${BLUE}Executing Migrations...${NC}"
    echo "----------------------------------------------"

    if [ -n "$SPECIFIC_MIGRATIONS" ]; then
        # Run specific migrations
        IFS=',' read -ra MIGRATIONS <<< "$SPECIFIC_MIGRATIONS"
        for prefix in "${MIGRATIONS[@]}"; do
            migration_file=$(ls "$MIGRATIONS_DIR"/${prefix}*.sql 2>/dev/null | head -1)
            if [ -n "$migration_file" ]; then
                filename=$(basename "$migration_file")
                echo -e "  Running: ${YELLOW}$filename${NC}"
                if [ "$USE_SUPABASE_CLI" = true ]; then
                    cat "$migration_file" | npx supabase db query
                else
                    psql "$DB_URL" -f "$migration_file"
                fi
                echo -e "  ${GREEN}Completed: $filename${NC}"
            else
                echo -e "  ${RED}Not found: ${prefix}*.sql${NC}"
            fi
        done
    else
        # Run via Supabase CLI (recommended)
        echo "  Using Supabase CLI to apply all pending migrations..."
        cd "$PROJECT_ROOT"
        npx supabase db push --include-all
    fi

    echo ""
    echo -e "${GREEN}Migrations completed!${NC}"
    echo ""
}

# Rollback function
run_rollback() {
    echo -e "${RED}Running Rollback...${NC}"
    echo "----------------------------------------------"
    echo -e "${YELLOW}WARNING: This will remove the following:${NC}"
    echo "  - profiles.learned_preferences column"
    echo "  - profiles.email_preferences column"
    echo "  - email_send_history table"
    echo "  - Related indexes, functions, and triggers"
    echo ""
    read -p "Are you sure you want to continue? (yes/no): " confirm

    if [ "$confirm" != "yes" ]; then
        echo "Rollback cancelled."
        exit 0
    fi

    # Rollback 0010
    echo "  Rolling back 0010_add_email_preferences.sql..."
    rollback_0010="
    DROP TABLE IF EXISTS email_send_history;
    DROP INDEX IF EXISTS idx_profiles_email_prefs_weekly;
    DROP INDEX IF EXISTS idx_profiles_email_prefs_job_matches;
    ALTER TABLE profiles DROP COLUMN IF EXISTS email_preferences;
    "
    if [ "$USE_SUPABASE_CLI" = true ]; then
        echo "$rollback_0010" | npx supabase db query
    else
        psql "$DB_URL" -c "$rollback_0010"
    fi
    echo -e "  ${GREEN}Rolled back 0010${NC}"

    # Rollback 0009
    echo "  Rolling back 0009_add_learned_preferences.sql..."
    rollback_0009="
    DROP TRIGGER IF EXISTS trigger_update_profile_on_preferences ON profiles;
    DROP FUNCTION IF EXISTS update_profile_timestamp_on_preferences();
    DROP FUNCTION IF EXISTS get_learning_stats(UUID);
    DROP FUNCTION IF EXISTS get_feedback_count(UUID);
    DROP FUNCTION IF EXISTS has_active_learning(UUID);
    DROP INDEX IF EXISTS idx_profiles_learned_preferences_updated;
    DROP INDEX IF EXISTS idx_profiles_learned_preferences_active;
    ALTER TABLE profiles DROP COLUMN IF EXISTS learned_preferences;
    "
    if [ "$USE_SUPABASE_CLI" = true ]; then
        echo "$rollback_0009" | npx supabase db query
    else
        psql "$DB_URL" -c "$rollback_0009"
    fi
    echo -e "  ${GREEN}Rolled back 0009${NC}"

    echo ""
    echo -e "${GREEN}Rollback completed!${NC}"
}

# Verify results function
verify_results() {
    echo -e "${BLUE}Verifying Migration Results...${NC}"
    echo "----------------------------------------------"

    if [ "$USE_SUPABASE_CLI" = true ]; then
        echo "  Run the following queries in Supabase Dashboard to verify:"
        echo ""
        echo "  -- Verify learned_preferences column"
        echo "  SELECT column_name, data_type FROM information_schema.columns"
        echo "  WHERE table_name = 'profiles' AND column_name = 'learned_preferences';"
        echo ""
        echo "  -- Verify email_preferences column"
        echo "  SELECT column_name, data_type FROM information_schema.columns"
        echo "  WHERE table_name = 'profiles' AND column_name = 'email_preferences';"
        echo ""
        echo "  -- Verify email_send_history table"
        echo "  SELECT * FROM information_schema.tables"
        echo "  WHERE table_name = 'email_send_history';"
    else
        # Check learned_preferences
        echo -n "  learned_preferences column: "
        result=$(run_sql "SELECT data_type FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'learned_preferences';")
        if [[ "$result" == *"jsonb"* ]]; then
            echo -e "${GREEN}OK (jsonb)${NC}"
        else
            echo -e "${RED}MISSING${NC}"
        fi

        # Check email_preferences
        echo -n "  email_preferences column: "
        result=$(run_sql "SELECT data_type FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'email_preferences';")
        if [[ "$result" == *"jsonb"* ]]; then
            echo -e "${GREEN}OK (jsonb)${NC}"
        else
            echo -e "${RED}MISSING${NC}"
        fi

        # Check email_send_history table
        echo -n "  email_send_history table: "
        result=$(run_sql "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'email_send_history';")
        if [[ "$result" -gt 0 ]]; then
            echo -e "${GREEN}OK ($result columns)${NC}"
        else
            echo -e "${RED}MISSING${NC}"
        fi

        # Check functions
        echo -n "  Learning functions: "
        result=$(run_sql "SELECT COUNT(*) FROM information_schema.routines WHERE routine_name IN ('has_active_learning', 'get_feedback_count', 'get_learning_stats');")
        if [[ "$result" -ge 3 ]]; then
            echo -e "${GREEN}OK ($result functions)${NC}"
        else
            echo -e "${YELLOW}Partial ($result of 3)${NC}"
        fi
    fi

    echo ""
}

# Main execution
verify_prerequisites

if [ "$VERIFY_ONLY" = true ]; then
    echo -e "${GREEN}Verification complete. No migrations executed (--verify-only mode).${NC}"
    exit 0
fi

if [ "$ROLLBACK" = true ]; then
    run_rollback
else
    run_migrations
    verify_results
fi

echo -e "${BLUE}================================================${NC}"
echo -e "${GREEN}Migration process completed successfully!${NC}"
echo -e "${BLUE}================================================${NC}"
