# Cloudflare Workflows Deployment Guide

This guide covers deploying the HowlerHire background job system using Cloudflare Workflows.

## Architecture Overview

```
┌─────────────────────────┐         ┌──────────────────────────┐
│   SvelteKit (Pages)     │  HTTP   │  Workflows Worker        │
│                         │ ──────► │  (workers/workflows)     │
│  - Dashboard            │         │                          │
│  - API routes           │         │  ┌─────────────────────┐ │
│  - workflows.send()     │         │  │ Resume Generation   │ │
│                         │         │  │ Resume Parsing      │ │
└─────────────────────────┘         │  │ Profile Sync        │ │
                                    │  │ Job Discovery       │ │
                                    │  │ Weekly Summary      │ │
                                    │  └─────────────────────┘ │
                                    │                          │
                                    │  Cron Triggers:          │
                                    │  - Weekly: Mon 9 AM UTC  │
                                    │  - Daily: 6 AM UTC       │
                                    └──────────────────────────┘
```

## Prerequisites

1. **Cloudflare Account** with Workers Paid plan ($5/month)
   - Workflows require the paid plan
   - 5-minute CPU time per step

2. **Wrangler CLI** installed:
   ```bash
   npm install -g wrangler
   wrangler login
   ```

3. **Environment Variables** ready:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ANTHROPIC_API_KEY`
   - `RESEND_API_KEY` (for weekly summary emails)
   - `CLOUDFLARE_AI_GATEWAY_URL` (optional)

## Deployment Steps

### 1. Deploy the Workflows Worker

```bash
cd workers/workflows

# Install dependencies
npm install

# Set secrets
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put RESEND_API_KEY

# Deploy
wrangler deploy
```

The worker will be deployed to: `https://howlerhire-workflows.<your-subdomain>.workers.dev`

### 2. Configure SvelteKit Environment

Add these variables to your Cloudflare Pages environment:

```bash
# Via wrangler (for Pages)
wrangler pages secret put WORKFLOWS_WORKER_URL --project howlerhire
wrangler pages secret put WORKFLOWS_AUTH_TOKEN --project howlerhire
```

Or via Cloudflare Dashboard:
1. Go to Workers & Pages → howlerhire → Settings → Environment variables
2. Add:
   - `WORKFLOWS_WORKER_URL`: `https://howlerhire-workflows.<subdomain>.workers.dev`
   - `WORKFLOWS_AUTH_TOKEN`: Generate a secure token

### 3. Update Auth Token in Worker

Generate a secure token:
```bash
openssl rand -hex 32
```

Set it as a secret in the workflows worker:
```bash
cd workers/workflows
wrangler secret put WORKFLOWS_AUTH_TOKEN
```

## Workflow Details

### Resume Generation (`resume-generation`)

Generates tailored resumes using AI in 7 steps:
1. Check user usage limits
2. Fetch job details
3. Fetch user profile and experiences
4. Analyze job requirements with Claude
5. Generate optimized resume content
6. Calculate match scores
7. Save to database

**Trigger:**
```typescript
import { workflowsClient } from '$lib/server/workflows/client';

await workflowsClient.generateResume(userId, jobId, applicationId, skipUsageCheck);
```

### Resume Parsing (`resume-parsing`)

Parses uploaded PDF/DOCX resumes:
1. Fetch file from storage
2. Extract text using Claude's native PDF support
3. Parse structured data (contact, experience, skills)
4. Update user profile

**Trigger:**
```typescript
await workflowsClient.parseResume(userId, resumeId, fileUrl, 'pdf');
```

### Profile Sync (`profile-sync`)

Syncs profile from GitHub:
1. Fetch GitHub profile
2. Extract repositories and languages
3. Analyze README for skills
4. Update profile data

**Trigger:**
```typescript
await workflowsClient.syncProfile(userId, githubHandle);
```

### Job Discovery (`job-discovery`)

Searches job boards for matching positions:
1. Get user preferences
2. Search RemoteOK
3. Search WeWorkRemotely
4. Deduplicate results
5. Calculate match scores
6. Save to database

**Trigger:**
```typescript
await workflowsClient.discoverJobs(userId, { keywords: ['engineer'], remote: true });
```

### Weekly Summary (`weekly-summary`)

Sends weekly email summaries (cron-triggered):
1. Get users with email preferences enabled
2. Calculate week's statistics
3. Generate and send emails via Resend

**Cron:** `0 9 * * 1` (Mondays at 9 AM UTC)

## Migration from Inngest

The `workflows.send()` function provides backward compatibility:

```typescript
// Old Inngest style (still works)
import { workflows } from '$lib/server/workflows/client';

await workflows.send({
  name: 'resume/generation.requested',
  data: { userId, jobId, applicationId }
});

// New direct style (recommended)
import { workflowsClient } from '$lib/server/workflows/client';

await workflowsClient.generateResume(userId, jobId, applicationId);
```

## Monitoring

### Check Workflow Status

```typescript
const status = await workflowsClient.getStatus('resume-generation', instanceId);
// Returns: { status: 'running' | 'complete' | 'errored', output?, error? }
```

### Health Check

```bash
curl https://howlerhire-workflows.<subdomain>.workers.dev/health
```

### View Logs

```bash
wrangler tail howlerhire-workflows
```

## Troubleshooting

### Workflow Timeout

Each step has a 5-minute CPU limit. If a step exceeds this:
1. Break it into smaller steps
2. Use `step.sleep()` for rate limiting
3. Batch operations (e.g., process jobs in chunks)

### Database Connection Issues

Each workflow step creates a fresh Supabase client to avoid connection pooling issues on Cloudflare Workers.

### Missing Secrets

Check all secrets are set:
```bash
wrangler secret list
```

### Cron Not Triggering

Verify cron triggers in `wrangler.toml`:
```toml
[triggers]
crons = ["0 9 * * 1", "0 6 * * *"]
```

## Cost Considerations

- **Workers Paid**: $5/month base
- **CPU Time**: Included in paid plan (10M requests/month)
- **Workflows**: No additional cost, uses Worker CPU time
- **AI Gateway** (optional): Free tier available

## Security

1. **Auth Token**: All HTTP triggers require Bearer token authentication
2. **Secrets**: All sensitive values stored as Wrangler secrets
3. **CORS**: Configured for cross-origin requests from Pages
