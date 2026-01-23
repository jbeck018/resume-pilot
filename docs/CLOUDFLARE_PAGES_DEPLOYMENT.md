# Cloudflare Pages Deployment Guide - Resume Pilot

This guide provides step-by-step instructions for deploying Resume Pilot to Cloudflare Pages.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [First-Time Setup](#first-time-setup)
3. [Environment Variables](#environment-variables)
4. [First Deployment](#first-deployment)
5. [Subsequent Deployments](#subsequent-deployments)
6. [Custom Domain Setup](#custom-domain-setup)
7. [Rollback Procedures](#rollback-procedures)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before deploying, ensure you have:

- Node.js 20+ installed
- npm 9+ installed
- A Cloudflare account (free tier works)
- Git repository with your code
- All required API keys (Supabase, LLM providers, etc.)

---

## First-Time Setup

### Step 1: Install Wrangler CLI

Wrangler is Cloudflare's CLI tool for managing Workers and Pages projects.

```bash
# Install globally
npm install -g wrangler

# Verify installation
wrangler --version
```

### Step 2: Authenticate with Cloudflare

```bash
# Login to Cloudflare (opens browser for OAuth)
wrangler login

# Verify authentication
wrangler whoami
```

This will:
1. Open your browser to the Cloudflare login page
2. Ask you to authorize Wrangler
3. Store credentials locally in `~/.wrangler/config/default.toml`

### Step 3: Create the Pages Project

You have two options for creating a Pages project:

#### Option A: Via Wrangler CLI (Recommended)

```bash
# Navigate to your project directory
cd /Users/jacob/projects/resume-pilot

# Create the Pages project
wrangler pages project create resume-pilot
```

When prompted:
- **Production branch**: `main`

#### Option B: Via Cloudflare Dashboard

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Select your account
3. Navigate to **Workers & Pages** > **Create application** > **Pages**
4. Select **Connect to Git** or **Direct Upload**
5. Name your project `resume-pilot`
6. Set production branch to `main`

---

## Environment Variables

### Required Environment Variables

Set these in the Cloudflare Dashboard under **Workers & Pages** > **resume-pilot** > **Settings** > **Environment variables**:

#### Supabase (Required)

| Variable | Type | Description |
|----------|------|-------------|
| `PUBLIC_SUPABASE_URL` | Plain text | Supabase project URL |
| `PUBLIC_SUPABASE_ANON_KEY` | Plain text | Supabase anonymous/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Encrypted | Supabase service role key (keep secret) |
| `SUPABASE_DB_URL` | Encrypted | PostgreSQL connection string |

#### LLM Providers (At least one required)

| Variable | Type | Description |
|----------|------|-------------|
| `OPENAI_API_KEY` | Encrypted | OpenAI API key |
| `ANTHROPIC_API_KEY` | Encrypted | Anthropic API key |
| `GOOGLE_API_KEY` | Encrypted | Google AI API key |

#### Job Discovery APIs

| Variable | Type | Description |
|----------|------|-------------|
| `ADZUNA_APP_ID` | Plain text | Adzuna application ID |
| `ADZUNA_APP_KEY` | Encrypted | Adzuna API key |

#### Background Jobs (Inngest)

| Variable | Type | Description |
|----------|------|-------------|
| `INNGEST_EVENT_KEY` | Encrypted | Inngest event key |
| `INNGEST_SIGNING_KEY` | Encrypted | Inngest signing key |

#### Email (Resend)

| Variable | Type | Description |
|----------|------|-------------|
| `RESEND_API_KEY` | Encrypted | Resend API key |

#### Payments (Stripe)

| Variable | Type | Description |
|----------|------|-------------|
| `STRIPE_SECRET_KEY` | Encrypted | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Encrypted | Stripe webhook signing secret |
| `STRIPE_PUBLISHABLE_KEY` | Plain text | Stripe publishable key |

#### Application Settings

| Variable | Type | Description |
|----------|------|-------------|
| `PUBLIC_APP_URL` | Plain text | Your production URL (e.g., `https://resume-pilot.pages.dev`) |

#### Optional: Observability

| Variable | Type | Description |
|----------|------|-------------|
| `CLOUDFLARE_AI_GATEWAY_URL` | Plain text | Cloudflare AI Gateway URL |
| `LANGFUSE_PUBLIC_KEY` | Plain text | Langfuse public key |
| `LANGFUSE_SECRET_KEY` | Encrypted | Langfuse secret key |
| `LANGFUSE_HOST` | Plain text | Langfuse host URL |

### Setting Environment Variables via CLI

```bash
# Set a plain text variable
wrangler pages secret put PUBLIC_SUPABASE_URL --project-name resume-pilot

# Set an encrypted secret
wrangler pages secret put SUPABASE_SERVICE_ROLE_KEY --project-name resume-pilot

# List all secrets
wrangler pages secret list --project-name resume-pilot
```

### Setting Environment Variables via Dashboard

1. Go to **Workers & Pages** > **resume-pilot**
2. Click **Settings** > **Environment variables**
3. Click **Add variable**
4. Select **Production** and/or **Preview** environment
5. Enter variable name and value
6. Check **Encrypt** for sensitive values
7. Click **Save**

---

## First Deployment

### Step 1: Build the Project

```bash
# Install dependencies
npm install

# Run type checking
npm run check

# Run linting
npm run lint

# Build for production
npm run build
```

This creates the build output in `.svelte-kit/cloudflare/`.

### Step 2: Deploy to Cloudflare Pages

```bash
# Deploy to production
wrangler pages deploy .svelte-kit/cloudflare --project-name resume-pilot --branch main
```

Expected output:
```
Uploading... (X/X)
✨ Successfully published your Worker
✨ Deployment complete! Your site is live at:
https://resume-pilot.pages.dev
```

### Step 3: Verify Deployment

1. Visit your Pages URL: `https://resume-pilot.pages.dev`
2. Test authentication flow
3. Navigate through the dashboard
4. Check browser console for errors

---

## Subsequent Deployments

### Standard Deployment

```bash
# Pull latest changes
git pull origin main

# Install any new dependencies
npm install

# Type check
npm run check

# Build
npm run build

# Deploy
wrangler pages deploy .svelte-kit/cloudflare --project-name resume-pilot --branch main
```

### One-Line Deployment

Add this to your `package.json` scripts:

```json
{
  "scripts": {
    "deploy": "npm run build && wrangler pages deploy .svelte-kit/cloudflare --project-name resume-pilot --branch main",
    "deploy:preview": "npm run build && wrangler pages deploy .svelte-kit/cloudflare --project-name resume-pilot --branch preview"
  }
}
```

Then deploy with:

```bash
npm run deploy
```

### Preview Deployments

Deploy a preview version for testing:

```bash
# Deploy to a preview URL (non-production)
wrangler pages deploy .svelte-kit/cloudflare --project-name resume-pilot --branch feature-branch

# This creates a URL like: https://feature-branch.resume-pilot.pages.dev
```

### Git Integration (Automatic Deployments)

For automatic deployments on push:

1. Go to **Workers & Pages** > **resume-pilot** > **Settings** > **Builds & deployments**
2. Click **Connect to Git**
3. Select your repository
4. Configure:
   - **Production branch**: `main`
   - **Build command**: `npm run build`
   - **Build output directory**: `.svelte-kit/cloudflare`
5. Save

Now every push to `main` automatically deploys.

---

## Custom Domain Setup

### Step 1: Add Custom Domain

Via Dashboard:
1. Go to **Workers & Pages** > **resume-pilot**
2. Click **Custom domains** > **Set up a custom domain**
3. Enter your domain (e.g., `app.yourcompany.com`)
4. Click **Activate domain**

Via CLI:
```bash
# Add custom domain
wrangler pages project add-custom-domain resume-pilot --domain app.yourcompany.com
```

### Step 2: Configure DNS

If your domain is managed by Cloudflare:
- DNS records are automatically configured

If your domain is external:
1. Add a CNAME record pointing to `resume-pilot.pages.dev`
2. Or follow the provided DNS instructions

### Step 3: SSL/TLS

Cloudflare automatically provisions SSL certificates. Full SSL is enabled by default.

To verify:
1. Go to **SSL/TLS** > **Overview**
2. Ensure mode is set to **Full** or **Full (strict)**

---

## Rollback Procedures

### View Deployment History

```bash
# List recent deployments
wrangler pages deployment list --project-name resume-pilot
```

Via Dashboard:
1. Go to **Workers & Pages** > **resume-pilot**
2. Click **Deployments**
3. View all deployments with timestamps

### Rollback to Previous Deployment

Via Dashboard (Recommended):
1. Go to **Workers & Pages** > **resume-pilot** > **Deployments**
2. Find the deployment you want to restore
3. Click the three-dot menu (...)
4. Select **Rollback to this deployment**
5. Confirm

Via CLI:
```bash
# Get deployment ID from list
wrangler pages deployment list --project-name resume-pilot

# Rollback is done by redeploying the old version
# First, checkout the old commit
git checkout <previous-commit-hash>

# Build and deploy
npm run build
wrangler pages deploy .svelte-kit/cloudflare --project-name resume-pilot --branch main

# Return to main branch
git checkout main
```

### Emergency Rollback Script

Create `scripts/rollback.sh`:

```bash
#!/bin/bash

# Emergency rollback script
# Usage: ./scripts/rollback.sh <commit-hash>

if [ -z "$1" ]; then
    echo "Usage: ./scripts/rollback.sh <commit-hash>"
    exit 1
fi

COMMIT=$1
CURRENT_BRANCH=$(git branch --show-current)

echo "Rolling back to commit: $COMMIT"

# Stash any local changes
git stash

# Checkout the specified commit
git checkout $COMMIT

# Build
npm install
npm run build

# Deploy
wrangler pages deploy .svelte-kit/cloudflare --project-name resume-pilot --branch main

# Return to original branch
git checkout $CURRENT_BRANCH

# Restore stashed changes
git stash pop

echo "Rollback complete!"
```

Make it executable:
```bash
chmod +x scripts/rollback.sh
```

---

## Troubleshooting

### Common Issues

#### 1. Build Fails

```
Error: Build failed
```

**Solution:**
```bash
# Clear caches and rebuild
rm -rf node_modules .svelte-kit
npm install
npm run build
```

#### 2. Authentication Errors

```
Error: Not logged in
```

**Solution:**
```bash
# Re-authenticate
wrangler logout
wrangler login
```

#### 3. Missing Environment Variables

```
Error: Missing required environment variable
```

**Solution:**
- Check all variables are set in Cloudflare Dashboard
- Verify variable names match exactly (case-sensitive)
- Ensure secrets are set for the correct environment (Production/Preview)

#### 4. Node.js Compatibility

```
Error: Cannot find module 'X'
```

**Solution:**
Ensure `nodejs_compat` flag is enabled in `wrangler.toml`:
```toml
compatibility_flags = ["nodejs_compat"]
```

#### 5. Large Bundle Size

```
Error: Script size exceeds limit
```

**Solution:**
- Check for large dependencies
- Use dynamic imports for heavy modules
- Consider code splitting

### Viewing Logs

```bash
# Stream real-time logs
wrangler pages deployment tail --project-name resume-pilot

# View logs in dashboard
# Workers & Pages > resume-pilot > Deployments > [deployment] > Logs
```

### Checking Deployment Status

```bash
# List all deployments with status
wrangler pages deployment list --project-name resume-pilot
```

---

## Quick Reference Commands

```bash
# Install Wrangler
npm install -g wrangler

# Login
wrangler login

# Create project
wrangler pages project create resume-pilot

# Build
npm run build

# Deploy to production
wrangler pages deploy .svelte-kit/cloudflare --project-name resume-pilot --branch main

# Deploy preview
wrangler pages deploy .svelte-kit/cloudflare --project-name resume-pilot --branch preview

# Set secret
wrangler pages secret put SECRET_NAME --project-name resume-pilot

# List secrets
wrangler pages secret list --project-name resume-pilot

# View deployments
wrangler pages deployment list --project-name resume-pilot

# Stream logs
wrangler pages deployment tail --project-name resume-pilot

# Check auth
wrangler whoami

# Logout
wrangler logout
```

---

## Deployment Checklist

Before each deployment:

- [ ] All tests pass (`npm test`)
- [ ] Type checking passes (`npm run check`)
- [ ] Linting passes (`npm run lint`)
- [ ] Build succeeds locally (`npm run build`)
- [ ] Environment variables are set in Cloudflare
- [ ] Database migrations are applied (if any)
- [ ] Preview deployment tested (for major changes)

After deployment:

- [ ] Visit production URL
- [ ] Test authentication flow
- [ ] Test core functionality
- [ ] Check browser console for errors
- [ ] Monitor error tracking (if configured)
- [ ] Verify API integrations work

---

## Related Documentation

- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/commands/)
- [SvelteKit Cloudflare Adapter](https://kit.svelte.dev/docs/adapter-cloudflare)
- [Project Deployment Checklist](./DEPLOYMENT_CHECKLIST.md)

---

**Last Updated**: 2026-01-23
**Version**: 1.0.0
