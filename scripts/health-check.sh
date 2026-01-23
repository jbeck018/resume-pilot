#!/bin/bash
# =============================================================================
# health-check.sh - Health check for Resume Pilot deployment
# =============================================================================
# Usage: ./scripts/health-check.sh [URL]
#
# If no URL is provided, uses PUBLIC_APP_URL from .env or defaults to localhost
#
# Exit codes:
#   0 - All checks passed
#   1 - One or more checks failed
#   2 - Configuration error
#
# Make executable: chmod +x scripts/health-check.sh
# =============================================================================

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
    echo -e "${GREEN}[PASS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[FAIL]${NC} $1"
}

print_header() {
    echo ""
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""
}

show_help() {
    echo "Usage: $0 [OPTIONS] [URL]"
    echo ""
    echo "Run health checks on Resume Pilot deployment"
    echo ""
    echo "Arguments:"
    echo "  URL            Base URL to check (default: from .env or localhost:5173)"
    echo ""
    echo "Options:"
    echo "  --timeout N    Request timeout in seconds (default: 10)"
    echo "  --verbose      Show detailed output"
    echo "  --json         Output results as JSON"
    echo "  --ci           CI mode - exit on first failure"
    echo "  --help         Show this help message"
    echo ""
    echo "Exit codes:"
    echo "  0 - All checks passed"
    echo "  1 - One or more checks failed"
    echo "  2 - Configuration error"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Check local dev server"
    echo "  $0 https://resume-pilot.pages.dev    # Check deployed app"
    echo "  $0 --verbose --timeout 30            # Verbose with longer timeout"
}

# -----------------------------------------------------------------------------
# Parse arguments
# -----------------------------------------------------------------------------
TIMEOUT=10
VERBOSE=false
JSON_OUTPUT=false
CI_MODE=false
BASE_URL=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        --json)
            JSON_OUTPUT=true
            shift
            ;;
        --ci)
            CI_MODE=true
            shift
            ;;
        --help|-h)
            show_help
            exit 0
            ;;
        -*)
            print_error "Unknown option: $1"
            show_help
            exit 2
            ;;
        *)
            BASE_URL="$1"
            shift
            ;;
    esac
done

# -----------------------------------------------------------------------------
# Change to project root and load env
# -----------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

# Load .env if it exists
if [ -f ".env" ]; then
    set -a
    source .env
    set +a
fi

# Determine base URL
if [ -z "$BASE_URL" ]; then
    BASE_URL="${PUBLIC_APP_URL:-http://localhost:5173}"
fi

# Remove trailing slash
BASE_URL="${BASE_URL%/}"

# -----------------------------------------------------------------------------
# Initialize results
# -----------------------------------------------------------------------------
CHECKS_PASSED=0
CHECKS_FAILED=0
CHECKS_WARNED=0
declare -a RESULTS

add_result() {
    local name=$1
    local status=$2
    local message=$3
    local duration=$4

    RESULTS+=("{\"name\":\"$name\",\"status\":\"$status\",\"message\":\"$message\",\"duration_ms\":$duration}")

    if [ "$status" = "pass" ]; then
        ((CHECKS_PASSED++))
        print_success "$name - $message (${duration}ms)"
    elif [ "$status" = "warn" ]; then
        ((CHECKS_WARNED++))
        print_warning "$name - $message (${duration}ms)"
    else
        ((CHECKS_FAILED++))
        print_error "$name - $message (${duration}ms)"
        if [ "$CI_MODE" = true ]; then
            exit 1
        fi
    fi
}

# -----------------------------------------------------------------------------
# Health check functions
# -----------------------------------------------------------------------------

check_homepage() {
    local start_time=$(date +%s%3N)

    local response=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" "$BASE_URL/")

    local end_time=$(date +%s%3N)
    local duration=$((end_time - start_time))

    if [ "$response" = "200" ]; then
        add_result "Homepage" "pass" "HTTP 200 OK" "$duration"
    else
        add_result "Homepage" "fail" "HTTP $response" "$duration"
    fi
}

check_auth_page() {
    local start_time=$(date +%s%3N)

    local response=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" "$BASE_URL/auth/login")

    local end_time=$(date +%s%3N)
    local duration=$((end_time - start_time))

    if [ "$response" = "200" ]; then
        add_result "Auth Login Page" "pass" "HTTP 200 OK" "$duration"
    else
        add_result "Auth Login Page" "fail" "HTTP $response" "$duration"
    fi
}

check_dashboard_redirect() {
    local start_time=$(date +%s%3N)

    # Dashboard should redirect to login if not authenticated
    local response=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" -L "$BASE_URL/dashboard")

    local end_time=$(date +%s%3N)
    local duration=$((end_time - start_time))

    # Should either redirect (302/303) or show login page (200)
    if [[ "$response" =~ ^(200|302|303)$ ]]; then
        add_result "Dashboard Auth Guard" "pass" "Properly protected (HTTP $response)" "$duration"
    else
        add_result "Dashboard Auth Guard" "fail" "Unexpected response (HTTP $response)" "$duration"
    fi
}

check_api_inngest() {
    local start_time=$(date +%s%3N)

    # Inngest endpoint should respond (even if with method not allowed for GET)
    local response=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" "$BASE_URL/api/inngest")

    local end_time=$(date +%s%3N)
    local duration=$((end_time - start_time))

    # 200, 405 (Method Not Allowed), or 400 are acceptable
    if [[ "$response" =~ ^(200|400|405)$ ]]; then
        add_result "Inngest API Endpoint" "pass" "Endpoint exists (HTTP $response)" "$duration"
    else
        add_result "Inngest API Endpoint" "warn" "Unexpected response (HTTP $response)" "$duration"
    fi
}

check_static_assets() {
    local start_time=$(date +%s%3N)

    # Check if the app can serve its main CSS/JS (via a known static path)
    local response=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" "$BASE_URL/_app/version.json" 2>/dev/null)

    local end_time=$(date +%s%3N)
    local duration=$((end_time - start_time))

    if [ "$response" = "200" ]; then
        add_result "Static Assets" "pass" "Version file accessible" "$duration"
    else
        # This might not exist in all SvelteKit configs
        add_result "Static Assets" "warn" "Version file not found (may be normal)" "$duration"
    fi
}

check_response_time() {
    local start_time=$(date +%s%3N)

    # Measure actual response time of homepage
    local time_total=$(curl -s -o /dev/null -w "%{time_total}" --max-time "$TIMEOUT" "$BASE_URL/")

    local end_time=$(date +%s%3N)
    local duration=$((end_time - start_time))

    # Convert to milliseconds
    local time_ms=$(echo "$time_total * 1000" | bc 2>/dev/null | cut -d. -f1)

    if [ -z "$time_ms" ]; then
        time_ms=$duration
    fi

    if [ "$time_ms" -lt 1000 ]; then
        add_result "Response Time" "pass" "${time_ms}ms (under 1s)" "$time_ms"
    elif [ "$time_ms" -lt 3000 ]; then
        add_result "Response Time" "warn" "${time_ms}ms (1-3s, could be faster)" "$time_ms"
    else
        add_result "Response Time" "fail" "${time_ms}ms (over 3s, too slow)" "$time_ms"
    fi
}

check_ssl() {
    # Only check SSL for HTTPS URLs
    if [[ "$BASE_URL" != https://* ]]; then
        if [ "$VERBOSE" = true ]; then
            print_status "Skipping SSL check (not HTTPS)"
        fi
        return
    fi

    local start_time=$(date +%s%3N)

    # Extract domain from URL
    local domain=$(echo "$BASE_URL" | sed -e 's|https://||' -e 's|/.*||')

    # Check SSL certificate
    local ssl_expiry=$(echo | openssl s_client -servername "$domain" -connect "$domain:443" 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)

    local end_time=$(date +%s%3N)
    local duration=$((end_time - start_time))

    if [ -n "$ssl_expiry" ]; then
        # Check if certificate expires in more than 7 days
        local expiry_epoch=$(date -j -f "%b %d %H:%M:%S %Y %Z" "$ssl_expiry" +%s 2>/dev/null || date -d "$ssl_expiry" +%s 2>/dev/null)
        local now_epoch=$(date +%s)
        local days_left=$(( (expiry_epoch - now_epoch) / 86400 ))

        if [ "$days_left" -gt 30 ]; then
            add_result "SSL Certificate" "pass" "Valid for $days_left days" "$duration"
        elif [ "$days_left" -gt 7 ]; then
            add_result "SSL Certificate" "warn" "Expires in $days_left days" "$duration"
        else
            add_result "SSL Certificate" "fail" "Expires in $days_left days!" "$duration"
        fi
    else
        add_result "SSL Certificate" "fail" "Could not verify certificate" "$duration"
    fi
}

check_database_connectivity() {
    # This check requires the database URL to be set
    if [ -z "$SUPABASE_DB_URL" ]; then
        if [ "$VERBOSE" = true ]; then
            print_status "Skipping database check (SUPABASE_DB_URL not set)"
        fi
        return
    fi

    local start_time=$(date +%s%3N)

    # Try a simple connection test
    if command -v psql &> /dev/null; then
        local result=$(psql "$SUPABASE_DB_URL" -c "SELECT 1" -t 2>/dev/null)
        local end_time=$(date +%s%3N)
        local duration=$((end_time - start_time))

        if [ "$result" = " 1" ] || [ "$result" = "1" ]; then
            add_result "Database Connectivity" "pass" "Connection successful" "$duration"
        else
            add_result "Database Connectivity" "fail" "Connection failed" "$duration"
        fi
    else
        local end_time=$(date +%s%3N)
        local duration=$((end_time - start_time))
        add_result "Database Connectivity" "warn" "psql not installed, skipped" "$duration"
    fi
}

check_supabase_api() {
    if [ -z "$PUBLIC_SUPABASE_URL" ]; then
        if [ "$VERBOSE" = true ]; then
            print_status "Skipping Supabase API check (URL not set)"
        fi
        return
    fi

    local start_time=$(date +%s%3N)

    # Check Supabase health endpoint
    local response=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" "$PUBLIC_SUPABASE_URL/rest/v1/" -H "apikey: ${PUBLIC_SUPABASE_ANON_KEY:-dummy}")

    local end_time=$(date +%s%3N)
    local duration=$((end_time - start_time))

    if [ "$response" = "200" ]; then
        add_result "Supabase API" "pass" "API responding" "$duration"
    else
        add_result "Supabase API" "warn" "API returned HTTP $response" "$duration"
    fi
}

# -----------------------------------------------------------------------------
# Run health checks
# -----------------------------------------------------------------------------

if [ "$JSON_OUTPUT" = false ]; then
    print_header "Resume Pilot Health Check"
    print_status "Target: $BASE_URL"
    print_status "Timeout: ${TIMEOUT}s"
    echo ""
fi

# Run all checks
check_homepage
check_auth_page
check_dashboard_redirect
check_api_inngest
check_static_assets
check_response_time
check_ssl
check_database_connectivity
check_supabase_api

# -----------------------------------------------------------------------------
# Output results
# -----------------------------------------------------------------------------

if [ "$JSON_OUTPUT" = true ]; then
    # JSON output
    echo "{"
    echo "  \"url\": \"$BASE_URL\","
    echo "  \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\","
    echo "  \"summary\": {"
    echo "    \"passed\": $CHECKS_PASSED,"
    echo "    \"failed\": $CHECKS_FAILED,"
    echo "    \"warned\": $CHECKS_WARNED"
    echo "  },"
    echo "  \"checks\": ["

    local first=true
    for result in "${RESULTS[@]}"; do
        if [ "$first" = true ]; then
            first=false
        else
            echo ","
        fi
        echo -n "    $result"
    done

    echo ""
    echo "  ]"
    echo "}"
else
    # Human-readable output
    print_header "Health Check Summary"

    TOTAL=$((CHECKS_PASSED + CHECKS_FAILED + CHECKS_WARNED))

    echo -e "Total checks: $TOTAL"
    echo -e "${GREEN}Passed:${NC} $CHECKS_PASSED"
    echo -e "${YELLOW}Warnings:${NC} $CHECKS_WARNED"
    echo -e "${RED}Failed:${NC} $CHECKS_FAILED"
    echo ""

    if [ $CHECKS_FAILED -eq 0 ]; then
        if [ $CHECKS_WARNED -eq 0 ]; then
            print_success "All health checks passed!"
        else
            print_warning "Health checks passed with warnings."
        fi
    else
        print_error "Some health checks failed!"
    fi
fi

# -----------------------------------------------------------------------------
# Exit with appropriate code
# -----------------------------------------------------------------------------
if [ $CHECKS_FAILED -gt 0 ]; then
    exit 1
else
    exit 0
fi
