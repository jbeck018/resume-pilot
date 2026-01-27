# Inngest Production Setup Guide

This guide covers deploying HowlerHire's background job system powered by Inngest.

## Table of Contents

1. [Overview](#overview)
2. [Registered Functions](#registered-functions)
3. [Environment Variables](#environment-variables)
4. [Production Setup Steps](#production-setup-steps)
5. [Cron Schedules](#cron-schedules)
6. [Verification Checklist](#verification-checklist)
7. [Troubleshooting](#troubleshooting)

---

## Overview

HowlerHire uses [Inngest](https://www.inngest.com/) for:

- **Background job processing** - Resume generation, parsing, and job discovery
- **Scheduled tasks** - Daily job discovery and weekly summary emails
- **Event-driven workflows** - Multi-step functions with automatic retries

**Endpoint:** `/api/inngest` (SvelteKit API route)

**Client ID:** `howlerhire`

---

## Registered Functions

### 1. Daily Job Discovery (`daily-job-discovery`)

**Trigger:** `job/discovery.requested` event

**Purpose:** Searches multiple job boards (Adzuna, Muse, Greenhouse, Lever) for jobs matching a user's profile, generates embeddings, scores matches, and queues resume generation.

**Steps:**
1. Get user profile and preferences
2. Get profile embedding (for semantic matching)
3. Load learned preferences from feedback history
4. Get existing job IDs to avoid duplicates
5. Search all job sources in parallel
6. Filter duplicates
7. Generate job embeddings
8. Score and rank jobs (with learning adjustments)
9. Save new jobs to database
10. Queue resume generation (respecting usage limits)
11. Log search history
12. Send job matches email notification

**Concurrency:** Default (no limit)

**Retries:** Default (3)

---

### 2. Schedule Daily Discovery (`schedule-daily-discovery`)

**Trigger:** Cron - `0 6 * * *` (6:00 AM UTC daily)

**Purpose:** Triggers job discovery for all active users automatically.

**Steps:**
1. Get all active users
2. Send `job/discovery.requested` event for each user

---

### 3. Resume Generation (`generate-resume-for-job`)

**Trigger:** `resume/generation.requested` event

**Purpose:** Generates tailored resume and cover letter for a specific job using the agentic orchestrator (coordinates ResumeAgent, CoverLetterAgent, JobMatchAgent).

**Event Data:**
```typescript
{
  userId: string;
  jobId: string;
  applicationId: string;
  skipUsageCheck?: boolean; // For admin/system operations
}
```

**Steps:**
1. Check usage limit (unless skipped)
2. Get job details
3. Get user profile and default resume
4. Generate application using agentic orchestrator
5. Save application with generated content
6. Increment usage counter
7. Send resume ready email notification

**Concurrency:** 5 (limits concurrent LLM calls)

**Retries:** 3

---

### 4. Resume Parsing (`parse-resume-file`)

**Trigger:** `resume/parsing.requested` event

**Purpose:** Parses uploaded PDF/DOCX resumes, extracts text, and structures data using LLM.

**Event Data:**
```typescript
{
  userId: string;
  resumeId: string;
  fileUrl: string;
  fileType: 'pdf' | 'docx';
}
```

**Steps:**
1. Download file from Supabase Storage
2. Extract text (PDF or DOCX)
3. Structure content using LLM
4. Save parsed data to resume record
5. Update user profile with extracted skills (if empty)

**Concurrency:** 3

**Retries:** 2

---

### 5. Weekly Summary Emails (`send-weekly-summaries`)

**Trigger:** Cron - `0 9 * * 1` (Monday 9:00 AM UTC)

**Purpose:** Sends weekly activity summary emails to all users who opted in.

**Steps:**
1. Get all users with weekly summary preference enabled
2. For each user:
   - Calculate jobs discovered, resumes generated, applications submitted
   - Get top match job for the week
   - Send summary email
   - Log to email history

---

## Environment Variables

### Required for Production

```bash
# Inngest Keys (from Inngest Dashboard)
INNGEST_EVENT_KEY=your-event-key
INNGEST_SIGNING_KEY=your-signing-key
```

### How to Get Your Keys

1. **INNGEST_EVENT_KEY**: Used to send events to Inngest
   - Found in: Inngest Dashboard → Manage → Event Keys
   - Format: Starts with `event_` or similar

2. **INNGEST_SIGNING_KEY**: Used to verify incoming webhook requests
   - Found in: Inngest Dashboard → Manage → Signing Keys
   - Format: Starts with `signkey-` followed by environment prefix

---

## Production Setup Steps

### Step 1: Create an Inngest Account

1. Go to [https://www.inngest.com/](https://www.inngest.com/)
2. Sign up with GitHub or email
3. Create a new app (or use default)

### Step 2: Get API Keys

1. Navigate to the Inngest Dashboard
2. Go to **Manage** → **Event Keys**
3. Copy or create an **Event Key** for production
4. Go to **Manage** → **Signing Keys**
5. Copy the **Production Signing Key**

### Step 3: Configure Environment Variables

Add to your production environment (e.g., Cloudflare Workers, Vercel, etc.):

```bash
INNGEST_EVENT_KEY=your-production-event-key
INNGEST_SIGNING_KEY=signkey-prod-xxxxxxxx
```

### Step 4: Deploy Your Application

Deploy HowlerHire to your production host. The `/api/inngest` endpoint will be available at:

```
https://your-domain.com/api/inngest
```

### Step 5: Register the Webhook URL in Inngest

1. In Inngest Dashboard, go to **Apps** (or **Manage** → **Apps**)
2. Click **Sync New App** or **Add App**
3. Enter your production URL:
   ```
   https://your-domain.com/api/inngest
   ```
4. Inngest will discover your functions automatically

### Step 6: Verify Function Registration

After syncing, you should see these 5 functions registered:

| Function ID | Name | Trigger |
|-------------|------|---------|
| `daily-job-discovery` | Daily Job Discovery | `job/discovery.requested` |
| `schedule-daily-discovery` | Schedule Daily Discovery | Cron: `0 6 * * *` |
| `generate-resume-for-job` | Generate Resume for Job | `resume/generation.requested` |
| `parse-resume-file` | Parse Resume File | `resume/parsing.requested` |
| `send-weekly-summaries` | Send Weekly Summary Emails | Cron: `0 9 * * 1` |

### Step 7: Test Event Sending

From your application, send a test event:

```typescript
import { inngest } from '$lib/server/inngest';

// Test job discovery
await inngest.send({
  name: 'job/discovery.requested',
  data: { userId: 'test-user-id' }
});

// Test resume parsing
await inngest.send({
  name: 'resume/parsing.requested',
  data: {
    userId: 'user-id',
    resumeId: 'resume-id',
    fileUrl: 'https://...',
    fileType: 'pdf'
  }
});
```

---

## Cron Schedules

### Current Schedules

| Function | Cron Expression | Schedule | Timezone |
|----------|----------------|----------|----------|
| `schedule-daily-discovery` | `0 6 * * *` | Daily at 6:00 AM | UTC |
| `send-weekly-summaries` | `0 9 * * 1` | Mondays at 9:00 AM | UTC |

### Modifying Cron Schedules

Cron schedules are defined in the function configuration. To change:

**1. Edit the function file:**

```typescript
// src/lib/server/inngest/functions/job-discovery.ts
export const scheduleDailyDiscovery = inngest.createFunction(
  {
    id: 'schedule-daily-discovery',
    name: 'Schedule Daily Discovery'
  },
  { cron: '0 8 * * *' }, // Changed to 8 AM UTC
  async ({ step }) => {
    // ...
  }
);
```

**2. Common cron patterns:**

| Pattern | Description |
|---------|-------------|
| `0 6 * * *` | Every day at 6:00 AM UTC |
| `0 8 * * *` | Every day at 8:00 AM UTC |
| `0 */4 * * *` | Every 4 hours |
| `0 9 * * 1` | Every Monday at 9:00 AM UTC |
| `0 9 * * 1,4` | Monday and Thursday at 9:00 AM UTC |
| `0 6 * * 1-5` | Weekdays at 6:00 AM UTC |

**3. Redeploy** after changing schedules - Inngest will automatically pick up the new cron configuration when you sync the app.

### Time Zone Considerations

Inngest cron schedules run in **UTC**. To convert:

| User Timezone | UTC Offset | 6 AM UTC = |
|---------------|------------|------------|
| US Pacific (PST) | -8 | 10 PM previous day |
| US Pacific (PDT) | -7 | 11 PM previous day |
| US Eastern (EST) | -5 | 1 AM same day |
| US Eastern (EDT) | -4 | 2 AM same day |
| UK (GMT) | 0 | 6 AM same day |
| UK (BST) | +1 | 7 AM same day |
| Central Europe (CET) | +1 | 7 AM same day |
| Central Europe (CEST) | +2 | 8 AM same day |

---

## Verification Checklist

### Pre-Deployment

- [ ] `INNGEST_EVENT_KEY` configured in production environment
- [ ] `INNGEST_SIGNING_KEY` configured in production environment
- [ ] All Supabase environment variables configured
- [ ] All LLM API keys configured (OPENAI_API_KEY, ANTHROPIC_API_KEY)
- [ ] RESEND_API_KEY configured for email sending

### Post-Deployment

- [ ] App synced in Inngest Dashboard
- [ ] All 5 functions visible in Inngest Dashboard
- [ ] Cron functions showing next scheduled run time
- [ ] Test event sent and processed successfully
- [ ] Function logs visible in Inngest Dashboard

### Ongoing Monitoring

- [ ] Check Inngest Dashboard for failed functions
- [ ] Monitor function run times
- [ ] Review retry patterns for issues
- [ ] Check cron execution history

---

## Troubleshooting

### Functions Not Appearing

**Symptom:** Functions don't show up after syncing

**Solutions:**
1. Verify the `/api/inngest` endpoint is accessible (try visiting it)
2. Check that the signing key matches your environment
3. Re-sync the app in Inngest Dashboard
4. Check server logs for errors during sync

### Events Not Being Processed

**Symptom:** Events sent but functions don't run

**Solutions:**
1. Verify `INNGEST_EVENT_KEY` is correct
2. Check Inngest Dashboard → Events to see if events are received
3. Look for function errors in the Runs tab
4. Ensure the event name matches exactly (case-sensitive)

### Cron Jobs Not Running

**Symptom:** Scheduled functions don't execute

**Solutions:**
1. Check the function shows a "Next run" time in Dashboard
2. Verify the cron expression is valid
3. Ensure the app is synced and functions are registered
4. Check for errors in the Runs tab at the scheduled time

### Function Timeouts

**Symptom:** Functions fail with timeout errors

**Solutions:**
1. Inngest has a default 10-minute timeout per step
2. Break long operations into smaller steps
3. Consider increasing concurrency limits
4. Check if external APIs (job boards, LLMs) are slow

### Signing Key Errors

**Symptom:** 401 or signature verification errors

**Solutions:**
1. Ensure you're using the production signing key (not dev)
2. Check the signing key format (`signkey-prod-...`)
3. Verify no extra whitespace in environment variable
4. Regenerate the signing key if needed

---

## Event Reference

### Events You Can Send

```typescript
// Trigger job discovery for a user
await inngest.send({
  name: 'job/discovery.requested',
  data: { userId: string }
});

// Trigger resume generation
await inngest.send({
  name: 'resume/generation.requested',
  data: {
    userId: string,
    jobId: string,
    applicationId: string,
    skipUsageCheck?: boolean
  }
});

// Trigger resume parsing
await inngest.send({
  name: 'resume/parsing.requested',
  data: {
    userId: string,
    resumeId: string,
    fileUrl: string,
    fileType: 'pdf' | 'docx'
  }
});
```

### Events Emitted by Functions

```typescript
// Emitted by job discovery for each discovered job
// (triggers resume generation)
'resume/generation.requested'
```

---

## Cost Considerations

Inngest pricing is based on function runs:

- **Free tier:** 25,000 runs/month
- **Pro tier:** Starting at $25/month for more runs

For HowlerHire:
- Each user's daily job discovery = 1 run (+ N resume generations)
- Each resume generation = 1 run
- Each resume parse = 1 run
- Weekly summaries = 1 run per subscribed user

**Estimate for 100 active users:**
- Daily discovery: ~100 runs/day
- Resume generations: ~500 runs/day (5 jobs/user average)
- Weekly summaries: ~100 runs/week
- **Monthly total:** ~18,000 runs (within free tier)

---

## Support Resources

- [Inngest Documentation](https://www.inngest.com/docs)
- [SvelteKit Integration Guide](https://www.inngest.com/docs/reference/serve#sveltekit)
- [Cron Syntax Reference](https://crontab.guru/)
- [Inngest Discord Community](https://www.inngest.com/discord)
